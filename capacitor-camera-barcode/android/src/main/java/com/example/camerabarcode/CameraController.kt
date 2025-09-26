package com.example.camerabarcode

import android.content.ContentValues
import android.content.Context
import android.graphics.Color
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.HandlerThread
import android.provider.MediaStore
import android.util.TypedValue
import android.view.Gravity
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.core.UseCaseGroup
import androidx.camera.core.CameraEffect
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.FallbackStrategy
import androidx.camera.video.MediaStoreOutputOptions
import androidx.camera.video.Quality
import androidx.camera.video.QualitySelector
import androidx.camera.video.Recorder
import androidx.camera.video.Recording
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.getcapacitor.Bridge
import androidx.camera.effects.OverlayEffect
import androidx.camera.effects.Frame
import androidx.arch.core.util.Function
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class CameraController(
        private val activity: AppCompatActivity,
        private val context: Context,
        @Suppress("UNUSED_PARAMETER") private val bridge: Bridge,
        private val onBarcode: (String, String) -> Unit,
) {
  private var cameraProvider: ProcessCameraProvider? = null
  private var camera: Camera? = null

  private var previewView: PreviewView? = null
  private var preview: Preview? = null
  private var overlayTextView: TextView? = null

  private var analysis: ImageAnalysis? = null
  private var analysisExecutor: ExecutorService = Executors.newSingleThreadExecutor()

  private var recorder: Recorder? = null
  private var videoCapture: VideoCapture<Recorder>? = null
  private var activeRecording: Recording? = null
  private var lastOutputUri: Uri? = null
  private val finalizeCallbacks = mutableListOf<(String?) -> Unit>()

  private var withAudio: Boolean = true
  private val mainExecutor by lazy { ContextCompat.getMainExecutor(context) }
  private var currentQuality: Quality = Quality.HD

  // ===== Cấu hình timestamp overlay (hiện tạm thời không dùng CameraX Effects) =====
  private var overlayEnabled = false
  private var overlayFormat = "yyyy-MM-dd HH:mm:ss"
  private var overlayTextSizePx = 42f
  private var overlayColor = Color.WHITE
  private var overlayMarginPx = 20f
  private var lastToBack: Boolean = true // nhớ tham số toBack để rebind

  private val uiHandler = Handler(Looper.getMainLooper())
  private var overlayEffect: OverlayEffect? = null
  private var overlayThread: HandlerThread? = null
  private var effectEnabled: Boolean = true
  // Track PreviewView measured size so we can scale effect drawings to match on-screen preview
  private var previewWidthPx: Int = 0
  private var previewHeightPx: Int = 0
  private val overlayTicker =
          object : Runnable {
            override fun run() {
              if (overlayEnabled) {
                overlayTextView?.text = formattedNow()
                // schedule next tick
                uiHandler.postDelayed(this, 1000L)
              }
            }
          }

  fun startPreview(toBack: Boolean, withAudio: Boolean) {
    this.withAudio = withAudio
    this.lastToBack = toBack
    val providerFuture = ProcessCameraProvider.getInstance(context)
    providerFuture.addListener(
            {
              cameraProvider = providerFuture.get()
              bindUseCases(toBack)
            },
            ContextCompat.getMainExecutor(context)
    )
  }

  private fun bindUseCases(toBack: Boolean) {
    val provider = cameraProvider ?: return
    provider.unbindAll()

    // Close previous effect to avoid leaks when rebinding
    try { overlayEffect?.close() } catch (_: Exception) {}
    overlayEffect = null

    if (previewView == null) {
      previewView =
              PreviewView(context).apply {
                layoutParams =
                        FrameLayout.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT
                        )
                implementationMode = PreviewView.ImplementationMode.COMPATIBLE
                scaleType = PreviewView.ScaleType.FILL_CENTER
                // Capture measured size for scaling the recording overlay to match preview size
                addOnLayoutChangeListener { v, _, _, _, _, _, _, _, _ ->
                  previewWidthPx = v.width
                  previewHeightPx = v.height
                }
              }
      val root = activity.findViewById<ViewGroup>(android.R.id.content)
      if (toBack) root.addView(previewView, 0) else root.addView(previewView)
    }

    // Ensure overlay TextView exists and is attached regardless of previewView lifecycle
    if (overlayTextView == null) {
      overlayTextView =
              TextView(context).apply {
                setTextColor(overlayColor)
                setTextSize(TypedValue.COMPLEX_UNIT_PX, overlayTextSizePx)
                setShadowLayer(4f, 1f, 1f, Color.BLACK)
                text = formattedNow()
                // keep this view above others
                try { elevation = 10000f } catch (_: Exception) {}
                try { z = 10000f } catch (_: Exception) {}
                val lp =
                        FrameLayout.LayoutParams(
                                        FrameLayout.LayoutParams.WRAP_CONTENT,
                                        FrameLayout.LayoutParams.WRAP_CONTENT
                                )
                                .apply {
                                  gravity = Gravity.BOTTOM or Gravity.END
                                  val m = overlayMarginPx.toInt()
                                  setMargins(m, m, m, m)
                                }
                layoutParams = lp
              }
    }

    val root = activity.findViewById<ViewGroup>(android.R.id.content)
    overlayTextView?.let { tv ->
      val alreadyAttached = tv.parent != null
      if (!alreadyAttached) {
        tv.isClickable = false
        tv.isFocusable = false
        tv.isFocusableInTouchMode = false
        tv.setOnTouchListener { _, _ -> false }
        tv.importantForAccessibility = android.view.View.IMPORTANT_FOR_ACCESSIBILITY_NO
        root.addView(tv)
      }
      tv.visibility = if (overlayEnabled) TextView.VISIBLE else TextView.GONE
    }

    val camSelector = CameraSelector.DEFAULT_BACK_CAMERA

    // Preview
    preview =
            Preview.Builder().build().also { it.setSurfaceProvider(previewView!!.surfaceProvider) }

    // ImageAnalysis + ML Kit (quét barcode)
    val scanner = BarcodeScanning.getClient()
    analysis =
            ImageAnalysis.Builder()
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .build()
                    .also { ia ->
                      ia.setAnalyzer(analysisExecutor) { imageProxy ->
                        val mediaImage = imageProxy.image
                        if (mediaImage != null) {
                          val rot = imageProxy.imageInfo.rotationDegrees
                          val image = InputImage.fromMediaImage(mediaImage, rot)
                          scanner.process(image)
                                  .addOnSuccessListener { barcodes ->
                                    val first = barcodes.firstOrNull()
                                    if (first != null) {
                                      val value = first.rawValue ?: ""
                                      val fmt = fmtName(first.format)
                                      if (value.isNotEmpty()) onBarcode(value, fmt)
                                    }
                                  }
                                  .addOnCompleteListener { imageProxy.close() }
                        } else {
                          imageProxy.close()
                        }
                      }
                    }

    // VideoCapture (Recorder API) - build QualitySelector based on currentQuality preference
    val ordered = when (currentQuality) {
      Quality.UHD -> listOf(Quality.UHD, Quality.FHD, Quality.HD, Quality.SD)
      Quality.FHD -> listOf(Quality.FHD, Quality.HD, Quality.SD)
      Quality.HD -> listOf(Quality.HD, Quality.SD)
      else -> listOf(Quality.SD, Quality.HD)
    }
    val qualitySelector =
      QualitySelector.fromOrderedList(
        ordered,
        FallbackStrategy.lowerQualityOrHigherThan(currentQuality)
      )
    recorder = Recorder.Builder().setQualitySelector(qualitySelector).build()
    videoCapture = VideoCapture.withOutput(recorder!!)

    val groupBuilder = UseCaseGroup.Builder()
    // Attach a CameraX OverlayEffect to burn-in timestamp into recorded frames only
    buildOverlayEffectIfNeeded()?.let { effect -> groupBuilder.addEffect(effect) }
    groupBuilder
      .addUseCase(preview!!)
      .addUseCase(analysis!!)
      .addUseCase(videoCapture!!)

    previewView?.viewPort?.let { groupBuilder.setViewPort(it) }
    val useCaseGroup = groupBuilder.build()

    try {
      camera = provider.bindToLifecycle(activity as LifecycleOwner, camSelector, useCaseGroup)
    } catch (e: Exception) {
      // If binding fails (e.g., unsupported quality or effect incompatibility), try fallbacks
      if (currentQuality != Quality.HD) {
        currentQuality = Quality.HD
        bindUseCases(toBack)
        return
      }
      if (currentQuality != Quality.SD) {
        currentQuality = Quality.SD
        bindUseCases(toBack)
        return
      }
      // As a last resort, disable effect and try again at SD
      if (effectEnabled) {
        effectEnabled = false
        bindUseCases(toBack)
        return
      }
      throw e
    }
  }

  private fun buildOverlayEffectIfNeeded(): OverlayEffect? {
    // Build an OverlayEffect that targets VIDEO_CAPTURE. We always return an effect so that
    // frames pass through even if overlayEnabled is false (we simply draw nothing).
    if (!effectEnabled) return null

    val thread = overlayThread ?: HandlerThread("CameraOverlayEffect").also {
      it.start()
      overlayThread = it
    }
    val handler = Handler(thread.looper)

    val effect = OverlayEffect(
      CameraEffect.VIDEO_CAPTURE,
      /*queueDepth=*/ 0,
      handler
    ) { throwable ->
      // Swallow errors to avoid crashing; could log if needed
    }

    effect.setOnDrawListener(Function<Frame, Boolean> { frame ->
      // Draw timestamp on the provided Canvas in buffer coordinates
      val canvas = frame.overlayCanvas
      if (canvas == null) return@Function true // nothing to draw, but keep frame

      // If overlay disabled, draw nothing and still return true to keep frames flowing
      if (!overlayEnabled) return@Function true

      try {
        // Clear previous overlay content to avoid ghosting/overdraw
        canvas.drawColor(
          android.graphics.Color.TRANSPARENT,
          android.graphics.PorterDuff.Mode.CLEAR
        )

        val size = frame.size
        val width = size.width
        val height = size.height

        val text = formattedNow()

        // Scale text size and margins so that the perceived size matches PreviewView
        val pw = previewWidthPx
        val ph = previewHeightPx
        val scaleW = if (pw > 0) width.toFloat() / pw else 1f
        val scaleH = if (ph > 0) height.toFloat() / ph else 1f
        val scale = kotlin.math.min(scaleW, scaleH).coerceAtLeast(0.5f)
        val textSizePx = overlayTextSizePx * scale
        val marginPx = overlayMarginPx * scale

        val paintStroke = android.graphics.Paint().apply {
          isAntiAlias = true
          color = android.graphics.Color.BLACK
          style = android.graphics.Paint.Style.STROKE
          // Make stroke relative to text size for consistent outline thickness
          strokeWidth = (textSizePx * 0.08f).coerceIn(2f, 12f)
          textSize = textSizePx
        }
        val paintFill = android.graphics.Paint().apply {
          isAntiAlias = true
          color = overlayColor
          style = android.graphics.Paint.Style.FILL
          textSize = textSizePx
        }

        val fm = paintFill.fontMetrics
        val textWidth = paintFill.measureText(text)
        val margin = marginPx
        val x = (width - margin - textWidth).coerceAtLeast(0f)
        val y = (height - margin - fm.bottom)

        // Optional: clear matrix to draw in buffer coords. If sensor mapping desired, call
        // canvas.matrix = frame.sensorToBufferTransform
        canvas.save()
        // Draw stroke for readability then fill
        canvas.drawText(text, x, y, paintStroke)
        canvas.drawText(text, x, y, paintFill)
        canvas.restore()
      } catch (_: Exception) {
        // ignore draw errors per-frame
      }
      true
    })

    overlayEffect = effect
    return effect
  }

  private fun fmtName(fmt: Int): String =
          when (fmt) {
            Barcode.FORMAT_QR_CODE -> "QR_CODE"
            Barcode.FORMAT_CODE_128 -> "CODE_128"
            Barcode.FORMAT_EAN_13 -> "EAN_13"
            Barcode.FORMAT_EAN_8 -> "EAN_8"
            Barcode.FORMAT_UPC_A -> "UPC_A"
            Barcode.FORMAT_UPC_E -> "UPC_E"
            Barcode.FORMAT_CODE_39 -> "CODE_39"
            Barcode.FORMAT_CODE_93 -> "CODE_93"
            Barcode.FORMAT_ITF -> "ITF"
            else -> "UNKNOWN"
          }

  fun setTorch(on: Boolean) {
    camera?.cameraControl?.enableTorch(on)
  }

  // Cho phép bật/tắt ghi âm runtime; áp dụng cho lần ghi tiếp theo
  fun setAudioEnabled(on: Boolean) {
    this.withAudio = on
  }

  private fun mapQuality(q: String?): Quality =
          when (q?.lowercase()) {
            "uhd", "4k" -> Quality.UHD
            "fhd", "fullhd", "full-hd", "1080p" -> Quality.FHD
            "hd", "720p" -> Quality.HD
            else -> Quality.SD
          }

  fun startRecording(prefix: String, quality: String, cb: (String) -> Unit) {
    // Recreate use cases if the requested quality differs
    val requested = mapQuality(quality)
    if (requested != currentQuality) {
      currentQuality = requested
      bindUseCases(lastToBack)
    }

    val vc = videoCapture ?: run {
      cb.invoke("")
      return
    }
    lastOutputUri = null

    // Make sure overlay remains on top when recording begins
    uiHandler.post {
      overlayTextView?.let { tv ->
        val root = activity.findViewById<ViewGroup>(android.R.id.content)
        // Re-attach if needed, then bring to front
        if (tv.parent == null) {
          tv.isClickable = false
          tv.isFocusable = false
          tv.isFocusableInTouchMode = false
          tv.setOnTouchListener { _, _ -> false }
          tv.importantForAccessibility = android.view.View.IMPORTANT_FOR_ACCESSIBILITY_NO
          root.addView(tv)
        }
        try { tv.elevation = 10000f } catch (_: Exception) {}
        try { tv.z = 10000f } catch (_: Exception) {}
        root.bringChildToFront(tv)
        tv.visibility = if (overlayEnabled) TextView.VISIBLE else TextView.GONE
        tv.requestLayout()
        tv.invalidate()
      }
    }

    val name = "${prefix}_${System.currentTimeMillis()}"
    val contentValues =
            ContentValues().apply {
              put(MediaStore.MediaColumns.DISPLAY_NAME, name)
              put(MediaStore.MediaColumns.MIME_TYPE, "video/mp4")
              put(MediaStore.Video.Media.RELATIVE_PATH, "Movies/CameraBarcode")
              put(MediaStore.Video.Media.IS_PENDING, 1)
            }

    val outputOptions =
            MediaStoreOutputOptions.Builder(
                            activity.contentResolver,
                            MediaStore.Video.Media.EXTERNAL_CONTENT_URI
                    )
                    .setContentValues(contentValues)
                    .build()

    var pending = vc.output.prepareRecording(context, outputOptions)
    if (withAudio) pending = pending.withAudioEnabled()

    activeRecording =
            pending.start(mainExecutor) { event ->
              when (event) {
                is VideoRecordEvent.Start -> Unit
                is VideoRecordEvent.Finalize -> {
                  lastOutputUri = event.outputResults.outputUri
                  lastOutputUri?.let { uri ->
                    try {
                      val cv = ContentValues().apply { put(MediaStore.Video.Media.IS_PENDING, 0) }
                      activity.contentResolver.update(uri, cv, null, null)
                    } catch (_: Exception) {}
                  }
                  if (finalizeCallbacks.isNotEmpty()) {
                    val uriString = lastOutputUri?.toString()
                    val list = finalizeCallbacks.toList()
                    finalizeCallbacks.clear()
                    list.forEach { it.invoke(uriString) }
                  }
                }
              }
            }

    cb.invoke("recording_started")
  }

  fun stopRecording(cb: (String?) -> Unit) {
    val rec = activeRecording
    if (rec == null) {
      cb.invoke(lastOutputUri?.toString())
      return
    }

    lastOutputUri?.let {
      activeRecording = null
      cb.invoke(it.toString())
      return
    }

    finalizeCallbacks.add(cb)
    rec.stop()
    activeRecording = null
  }

  // Cleanup resources when needed (could be called from a future release method)
  private fun cleanupOverlayResources() {
    try { overlayEffect?.close() } catch (_: Exception) {}
    overlayEffect = null
    overlayThread?.quitSafely()
    overlayThread = null
  }

  /**
   * Gọi từ plugin method `setTimestampOverlay` để bật/tắt & chỉnh style. Hiện tạm thời không áp
   * dụng CameraX ProcessorEffect do xung đột API. Có thể vẽ overlay qua PreviewView overlay (sẽ bổ
   * sung sau nếu cần).
   */
  fun setTimestampOverlay(
          enabled: Boolean,
          format: String?,
          textSizeSp: Float?,
          color: String?,
          marginDp: Float?
  ) {
    overlayEnabled = enabled
    format?.let { overlayFormat = it }

    // chuyển SP/DP -> PX
    val dm = context.resources.displayMetrics
    textSizeSp?.let { overlayTextSizePx = it * dm.scaledDensity }
    marginDp?.let { overlayMarginPx = it * dm.density }

    color?.let {
      try {
        overlayColor = Color.parseColor(it)
      } catch (_: Exception) {}
    }

    // Apply to TextView overlay on the main thread to avoid view-thread violations
    overlayTextView?.let { _ ->
      uiHandler.post {
        overlayTextView?.let { tv ->
          tv.setTextColor(overlayColor)
          tv.setTextSize(TypedValue.COMPLEX_UNIT_PX, overlayTextSizePx)
          (tv.layoutParams as? FrameLayout.LayoutParams)?.let { lp ->
            val m = overlayMarginPx.toInt()
            lp.setMargins(m, m, m, m)
            lp.gravity = Gravity.BOTTOM or Gravity.END
            tv.layoutParams = lp
          }
          tv.text = formattedNow()
          try { tv.elevation = 10000f } catch (_: Exception) {}
          try { tv.z = 10000f } catch (_: Exception) {}
          // ensure it stays on top each tick
          try {
            val root = activity.findViewById<ViewGroup>(android.R.id.content)
            if (tv.parent == null) root.addView(tv) else root.bringChildToFront(tv)
          } catch (_: Exception) {}
          tv.visibility = if (overlayEnabled) TextView.VISIBLE else TextView.GONE
          if (!overlayEnabled) {
            // Remove the view when disabled so it doesn't linger across pages
            try { (tv.parent as? ViewGroup)?.removeView(tv) } catch (_: Exception) {}
          }
        }
      }
    }

    // manage ticker
    uiHandler.removeCallbacks(overlayTicker)
    if (overlayEnabled) uiHandler.post(overlayTicker)
  }

  private fun formattedNow(): String {
    return try {
      val sdf = java.text.SimpleDateFormat(overlayFormat, java.util.Locale.getDefault())
      sdf.format(java.util.Date())
    } catch (_: Exception) {
      java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.getDefault())
              .format(java.util.Date())
    }
  }
}
