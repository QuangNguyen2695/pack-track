import Foundation
import Capacitor
import AVFoundation
import Vision
import UIKit
import Photos

@objc(CameraBarcode)
public class CameraBarcode: CAPPlugin, AVCaptureFileOutputRecordingDelegate {

    private let session = AVCaptureSession()
    private let movieOutput = AVCaptureMovieFileOutput()
    private var videoDevice: AVCaptureDevice?
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private var dataOutput = AVCaptureVideoDataOutput()
    private var withAudio = true

    private var tempRecordingURL: URL?

    // MARK: Preview
    @objc func startPreview(_ call: CAPPluginCall) {
        AVCaptureDevice.requestAccess(for: .video) { granted in
            if !granted {
                call.reject("Camera permission denied")
                return
            }
            if self.withAudio {
                AVCaptureDevice.requestAccess(for: .audio) { _ in }
            }
            DispatchQueue.main.async {
                self.configureSession(call)
            }
        }
    }

    private func configureSession(_ call: CAPPluginCall) {
        session.beginConfiguration()
        session.sessionPreset = .high

        guard let video = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
            call.reject("No back camera")
            return
        }
        videoDevice = video

        // Input video
        guard let vIn = try? AVCaptureDeviceInput(device: video), session.canAddInput(vIn) else {
            call.reject("Cannot add video input")
            return
        }
        session.addInput(vIn)

        // Input audio (optional)
        if withAudio, let mic = AVCaptureDevice.default(for: .audio),
           let aIn = try? AVCaptureDeviceInput(device: mic), session.canAddInput(aIn) {
            session.addInput(aIn)
        }

        // Movie output
        if session.canAddOutput(movieOutput) {
            session.addOutput(movieOutput)
        }

        // Data output for Vision
        dataOutput.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String:
                                    kCVPixelFormatType_32BGRA]
        dataOutput.setSampleBufferDelegate(self, queue: DispatchQueue(label: "analysis"))
        if session.canAddOutput(dataOutput) {
            session.addOutput(dataOutput)
        }

        // Preview layer
        if previewLayer == nil {
            previewLayer = AVCaptureVideoPreviewLayer(session: session)
            previewLayer?.videoGravity = .resizeAspectFill
            if let webview = bridge?.webView {
                previewLayer?.frame = webview.bounds
                webview.layer.insertSublayer(previewLayer!, at: 0) // toBack=true
                webview.isOpaque = false
                webview.backgroundColor = UIColor.clear
            }
        }

        session.commitConfiguration()
        session.startRunning()
        call.resolve()
    }

    @objc func startRecording(_ call: CAPPluginCall) {
        let prefix = call.getString("fileNamePrefix") ?? "VID"
        let filename = "\(prefix)_\(Int(Date().timeIntervalSince1970)).mov"
        let url = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent(filename)
        tempRecordingURL = url
        movieOutput.startRecording(to: url, recordingDelegate: self)
        call.resolve([
            "recordingId": filename
        ])
    }

    @objc func stopRecording(_ call: CAPPluginCall) {
        if movieOutput.isRecording {
            movieOutput.stopRecording()
            // Save completion -> delegate
            // Tạm thời resolve rỗng, bạn có thể phát sự kiện khi delegate hoàn tất
            call.resolve(["uri": tempRecordingURL?.absoluteString ?? ""])
        } else {
            call.resolve(["uri": ""])
        }
    }

    @objc func setTorch(_ call: CAPPluginCall) {
        let on = call.getBool("on") ?? false
        guard let device = videoDevice, device.hasTorch else {
            call.resolve()
            return
        }
        do {
            try device.lockForConfiguration()
            device.torchMode = on ? .on : .off
            device.unlockForConfiguration()
        } catch { }
        call.resolve()
    }

    // MARK: Movie delegate
    public func fileOutput(_ output: AVCaptureFileOutput, didFinishRecordingTo outputFileURL: URL, from connections: [AVCaptureConnection], error: Error?) {
        // Option: lưu vào Photos
        PHPhotoLibrary.shared().performChanges({
            PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL: outputFileURL)
        })
    }
}

// MARK: Vision barcode
extension CameraBarcode: AVCaptureVideoDataOutputSampleBufferDelegate {
    public func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {

        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        let request = VNDetectBarcodesRequest { req, _ in
            guard let results = req.results as? [VNBarcodeObservation], let first = results.first else { return }
            let value = first.payloadStringValue ?? ""
            if value.isEmpty { return }
            self.notifyListeners("barcode", data: [
                "value": value,
                "format": first.symbology.rawValue,
                "ts": Int(Date().timeIntervalSince1970 * 1000)
            ])
        }
        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: .up, options: [:])
        do { try handler.perform([request]) } catch {}
    }
}
