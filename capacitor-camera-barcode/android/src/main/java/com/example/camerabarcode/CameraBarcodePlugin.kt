package com.example.camerabarcode

import android.Manifest
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

@CapacitorPlugin(
  name = "CameraBarcode",
  permissions = [
    Permission(strings = [Manifest.permission.CAMERA], alias = "camera"),
    Permission(strings = [Manifest.permission.RECORD_AUDIO], alias = "audio")
  ]
)
class CameraBarcodePlugin : Plugin() {

  private var controller: CameraController? = null

  override fun load() {
    controller = CameraController(activity as androidx.appcompat.app.AppCompatActivity, context, bridge, ::onBarcode)
  }

  @PluginMethod
  fun startPreview(call: PluginCall) {
    if (!hasRequiredPermissions()) {
      requestAllPermissions(call, "onPermsResult")
      return
    }
    val toBack = call.getBoolean("toBack", true) ?: true
    val withAudio = call.getBoolean("withAudio", true) ?: true
    controller?.startPreview(toBack, withAudio)
    call.resolve()
  }

  @PluginMethod
  fun startRecording(call: PluginCall) {
    val prefix = call.getString("fileNamePrefix", "VID")
    val quality = call.getString("quality", "sd")
    controller?.startRecording(prefix ?: "VID", quality ?: "sd") { id ->
      val ret = JSObject()
      ret.put("recordingId", id)
      call.resolve(ret)
    } ?: call.reject("Controller not ready")
  }

  @PluginMethod
  fun stopRecording(call: PluginCall) {
    controller?.stopRecording { uri ->
      val ret = JSObject()
      ret.put("uri", uri ?: "")
      call.resolve(ret)
    } ?: call.reject("Controller not ready")
  }

  @PluginMethod
  fun setTorch(call: PluginCall) {
    val on = call.getBoolean("on", false) ?: false
    controller?.setTorch(on)
    call.resolve()
  }

  @PluginMethod
  fun setAudioEnabled(call: PluginCall) {
    val on = call.getBoolean("on", true) ?: true
    // If enabling audio but permission isn't granted yet, request it first
    if (on && !hasPermission("audio")) {
      requestPermissionForAlias("audio", call, "onAudioPerm")
      return
    }
    controller?.setAudioEnabled(on)
    call.resolve()
  }

  @PermissionCallback
  private fun onAudioPerm(call: PluginCall) {
    val on = call.getBoolean("on", true) ?: true
    if (hasPermission("audio")) {
      controller?.setAudioEnabled(on)
    }
    call.resolve()
  }

  @PluginMethod
  fun setTimestampOverlay(call: PluginCall) {
    try {
      val enabled = call.getBoolean("enabled", false) ?: false
      val format = call.getString("format")
      val textSizeSp = call.getDouble("textSizeSp")?.toFloat()
      val color = call.getString("color")
      val marginDp = call.getDouble("marginDp")?.toFloat()

      controller?.setTimestampOverlay(
        enabled = enabled,
        format = format,
        textSizeSp = textSizeSp,
        color = color,
        marginDp = marginDp
      )
      call.resolve()
    } catch (e: Exception) {
      // Avoid crashing the app; resolve with a noop result if something goes wrong
      val ret = JSObject()
      ret.put("error", e.message ?: "unknown_error")
      call.resolve(ret)
    }
  }

  @PermissionCallback
  private fun onPermsResult(call: PluginCall) {
    if (hasRequiredPermissions()) startPreview(call) else call.reject("Permission denied")
  }

  private fun onBarcode(value: String, format: String) {
    val data = JSObject()
    data.put("value", value)
    data.put("format", format)
    data.put("ts", System.currentTimeMillis())
    notifyListeners("barcode", data)
  }
}