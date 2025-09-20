package com.example.camerabarcode

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.provider.MediaStore
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.camera.video.FallbackStrategy
import androidx.camera.video.MediaStoreOutputOptions
import androidx.camera.video.Quality
import androidx.camera.video.QualitySelector
import androidx.camera.video.Recording
import androidx.camera.video.Recorder
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.getcapacitor.Bridge
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class CameraController(
  private val activity: AppCompatActivity,
  private val context: Context,
  @Suppress("UNUSED_PARAMETER")
  private val bridge: Bridge,
  private val onBarcode: (String, String) -> Unit,
) {
  private var cameraProvider: ProcessCameraProvider? = null
  private var camera: Camera? = null

  private var previewView: PreviewView? = null
  private var preview: Preview? = null

  private var analysis: ImageAnalysis? = null
  private var analysisExecutor: ExecutorService = Executors.newSingleThreadExecutor()

  private var recorder: Recorder? = null
  private var videoCapture: VideoCapture<Recorder>? = null
  private var activeRecording: Recording? = null
  private var lastOutputUri: Uri? = null
  private val finalizeCallbacks = mutableListOf<(String?) -> Unit>()

  private var withAudio: Boolean = true
  private val mainExecutor by lazy { ContextCompat.getMainExecutor(context) }

  fun startPreview(toBack: Boolean, withAudio: Boolean) {
    this.withAudio = withAudio
    val providerFuture = ProcessCameraProvider.getInstance(context)
    providerFuture.addListener({
      cameraProvider = providerFuture.get()
      bindUseCases(toBack)
    }, ContextCompat.getMainExecutor(context))
  }

  private fun bindUseCases(toBack: Boolean) {
    val provider = cameraProvider ?: return
    provider.unbindAll()

    if (previewView == null) {
      previewView = PreviewView(context).apply {
        layoutParams = FrameLayout.LayoutParams(
          ViewGroup.LayoutParams.MATCH_PARENT,
          ViewGroup.LayoutParams.MATCH_PARENT
        )
        implementationMode = PreviewView.ImplementationMode.COMPATIBLE
        scaleType = PreviewView.ScaleType.FILL_CENTER
      }
      val root = activity.findViewById<ViewGroup>(android.R.id.content)
      if (toBack) root.addView(previewView, 0) else root.addView(previewView)
    }

    val camSelector = CameraSelector.DEFAULT_BACK_CAMERA

    // Preview
    preview = Preview.Builder().build().also {
      it.setSurfaceProvider(previewView!!.surfaceProvider)
    }

    // ImageAnalysis + ML Kit
    val scanner = BarcodeScanning.getClient()
    analysis = ImageAnalysis.Builder()
      .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
      .build().also { ia ->
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

    // VideoCapture (Recorder API)
    val qualitySelector = QualitySelector.fromOrderedList(
      listOf(Quality.FHD, Quality.HD, Quality.SD),
      FallbackStrategy.lowerQualityOrHigherThan(Quality.SD)
    )

    recorder = Recorder.Builder()
      .setQualitySelector(qualitySelector)
      .build()

    videoCapture = VideoCapture.withOutput(recorder!!)

    camera = provider.bindToLifecycle(
      activity as LifecycleOwner,
      camSelector,
      preview,
      analysis,
      videoCapture
    )
  }

  private fun fmtName(fmt: Int): String = when (fmt) {
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

  private fun mapQuality(q: String?): Quality = when (q?.lowercase()) {
    "uhd", "4k" -> Quality.UHD
    "fhd", "1080p" -> Quality.FHD
    "hd", "720p" -> Quality.HD
    else -> Quality.SD
  }

  fun startRecording(prefix: String, quality: String, cb: (String) -> Unit) {
    val vc = videoCapture ?: run { cb.invoke(""); return }
    lastOutputUri = null

    val name = "${prefix}_${System.currentTimeMillis()}"
    val contentValues = ContentValues().apply {
      put(MediaStore.MediaColumns.DISPLAY_NAME, name)
      put(MediaStore.MediaColumns.MIME_TYPE, "video/mp4")
      put(MediaStore.Video.Media.RELATIVE_PATH, "Movies/CameraBarcode")
      put(MediaStore.Video.Media.IS_PENDING, 1)
    }

    val outputOptions = MediaStoreOutputOptions
      .Builder(activity.contentResolver, MediaStore.Video.Media.EXTERNAL_CONTENT_URI)
      .setContentValues(contentValues)
      .build()

    // NOTE: muốn đổi quality runtime -> phải rebind Recorder/VideoCapture với QualitySelector mới.
    @Suppress("UNUSED_VARIABLE")
    val requested = mapQuality(quality)

    var pending = vc.output.prepareRecording(context, outputOptions)
    if (withAudio) pending = pending.withAudioEnabled()

    activeRecording = pending.start(mainExecutor) { event ->
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
}
