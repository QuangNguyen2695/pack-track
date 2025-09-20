package com.example.camerabarcode

import android.Manifest
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import com.getcapacitor.PluginMethod


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
    controller = CameraController(
      activity as androidx.appcompat.app.AppCompatActivity,
      context,
      bridge,
      ::onBarcode
    )
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
    val prefix = call.getString("fileNamePrefix", "VID") ?: "VID"
    val quality = call.getString("quality", "sd") ?: "sd"
    controller?.startRecording(prefix, quality) { id ->
      val ret = JSObject().apply { put("recordingId", id) }
      call.resolve(ret)
    } ?: call.reject("Controller not ready")
  }

  @PluginMethod
  fun stopRecording(call: PluginCall) {
    controller?.stopRecording { uri ->
      val ret = JSObject().apply { put("uri", uri ?: "") }
      call.resolve(ret)
    } ?: call.reject("Controller not ready")
  }

  @PluginMethod
  fun setTorch(call: PluginCall) {
    val on = call.getBoolean("on", false) ?: false
    controller?.setTorch(on)
    call.resolve()
  }

  @PermissionCallback
  private fun onPermsResult(call: PluginCall) {
    if (hasRequiredPermissions()) startPreview(call) else call.reject("Permission denied")
  }

  private fun onBarcode(value: String, format: String) {
    val data = JSObject().apply {
      put("value", value)
      put("format", format)
      put("ts", System.currentTimeMillis())
    }
    notifyListeners("barcode", data)
  }
}
