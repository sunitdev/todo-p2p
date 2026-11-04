#if os(iOS)
import AVFoundation
import SwiftUI

struct PairingScanner: View {
    let receive: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var phase
    @State private var allowed = false
    @State private var message = "Requesting camera access…"
    var body: some View {
        VStack {
            if allowed { CameraPreview(receive: receive) } else { Text(message).padding() }
            Button("Cancel scanning") { dismiss() }
        }.onChange(of: phase) { _, value in
            if value == .background { dismiss() }
        }.task {
            allowed = await AVCaptureDevice.requestAccess(for: .video)
            if !allowed { message = "Camera access is unavailable. Allow camera access in Settings to scan a pairing code." }
        }
    }
}

private struct CameraPreview: UIViewControllerRepresentable {
    let receive: (String) -> Void
    func makeUIViewController(context: Context) -> CameraController { CameraController(receive: receive) }
    func updateUIViewController(_ controller: CameraController, context: Context) {}
    static func dismantleUIViewController(_ controller: CameraController, coordinator: ()) { controller.stop() }
}

private final class CameraController: UIViewController, @preconcurrency AVCaptureMetadataOutputObjectsDelegate {
    private let session = CameraSession()
    private let receive: (String) -> Void
    private var preview: AVCaptureVideoPreviewLayer?
    private var delivered = false
    init(receive: @escaping (String) -> Void) { self.receive = receive; super.init(nibName: nil, bundle: nil) }
    required init?(coder: NSCoder) { fatalError() }
    override func viewDidLoad() {
        super.viewDidLoad()
        guard let camera = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: camera), session.value.canAddInput(input) else {
            let label = UILabel(frame: view.bounds)
            label.text = "No camera is available on this device."
            label.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            view.addSubview(label)
            return
        }
        session.value.addInput(input)
        let output = AVCaptureMetadataOutput()
        guard session.value.canAddOutput(output) else { return }
        session.value.addOutput(output)
        output.setMetadataObjectsDelegate(self, queue: .main)
        output.metadataObjectTypes = [.qr]
        let layer = AVCaptureVideoPreviewLayer(session: session.value)
        layer.videoGravity = .resizeAspectFill
        view.layer.addSublayer(layer)
        preview = layer
        session.start()
    }
    override func viewDidLayoutSubviews() { super.viewDidLayoutSubviews(); preview?.frame = view.bounds }
    override func viewWillDisappear(_ animated: Bool) { super.viewWillDisappear(animated); stop() }
    func stop() { session.stop() }
    func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput objects: [AVMetadataObject], from connection: AVCaptureConnection) {
        guard !delivered, let text = (objects.first as? AVMetadataMachineReadableCodeObject)?.stringValue else { return }
        delivered = true
        stop()
        receive(text)
    }
}
private final class CameraSession: @unchecked Sendable {
    let value = AVCaptureSession()
    private let queue = DispatchQueue(label: "local.sunit.TodoP2P.camera")
    func start() { queue.async { self.value.startRunning() } }
    func stop() { queue.async { self.value.stopRunning() } }
}
#endif
