import AVFoundation
import SwiftUI

/// 카메라가 전체화면이 아니라 **영수증 안의 작은 창**이라 프리뷰 레이어를 직접 제어한다.
/// VisionKit 의 `DataScannerViewController` 는 자체 오버레이가 있어 이 디자인과 충돌한다.
@MainActor
final class CameraSession: NSObject, ObservableObject {
    enum Mode {
        case barcode
        case photo
    }

    enum Status: Equatable {
        case idle
        case running
        case denied
        case failed(String)
    }

    @Published private(set) var status: Status = .idle

    let session = AVCaptureSession()
    private let mode: Mode
    private let metadataOutput = AVCaptureMetadataOutput()
    private let photoOutput = AVCapturePhotoOutput()
    private let queue = DispatchQueue(label: "camera.session")

    /// 첫 인식 후 세션을 멈추고 화면을 넘긴다. 같은 바코드가 연속으로 잡히기 때문이다.
    var onBarcode: ((String) -> Void)?
    private var didCapture = false
    private var photoContinuation: CheckedContinuation<UIImage, Error>?

    init(mode: Mode) {
        self.mode = mode
        super.init()
    }

    func start() async {
        guard status != .running else { return }

        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            break
        case .notDetermined:
            guard await AVCaptureDevice.requestAccess(for: .video) else {
                status = .denied
                return
            }
        default:
            status = .denied
            return
        }

        if session.inputs.isEmpty {
            do { try configure() } catch {
                status = .failed(error.localizedDescription)
                return
            }
        }

        didCapture = false
        let session = session
        await withCheckedContinuation { continuation in
            queue.async {
                if !session.isRunning { session.startRunning() }
                continuation.resume()
            }
        }
        status = .running
    }

    func stop() {
        let session = session
        queue.async {
            if session.isRunning { session.stopRunning() }
        }
        status = .idle
    }

    private func configure() throws {
        session.beginConfiguration()
        defer { session.commitConfiguration() }

        session.sessionPreset = mode == .photo ? .photo : .high

        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
            throw CameraError.noDevice
        }
        let input = try AVCaptureDeviceInput(device: device)
        guard session.canAddInput(input) else { throw CameraError.noDevice }
        session.addInput(input)

        switch mode {
        case .barcode:
            guard session.canAddOutput(metadataOutput) else { throw CameraError.noDevice }
            session.addOutput(metadataOutput)
            metadataOutput.setMetadataObjectsDelegate(self, queue: .main)
            metadataOutput.metadataObjectTypes = [.ean13, .ean8, .upce, .code128]
        case .photo:
            guard session.canAddOutput(photoOutput) else { throw CameraError.noDevice }
            session.addOutput(photoOutput)
        }
    }

    /// 창 밖 바코드를 잡지 않도록 관심영역을 제한한다.
    /// `rectOfInterest` 는 프리뷰 레이어 좌표를 변환해서 넣어야 한다.
    func setRegionOfInterest(_ rect: CGRect, in layer: AVCaptureVideoPreviewLayer) {
        guard mode == .barcode else { return }
        let converted = layer.metadataOutputRectConverted(fromLayerRect: rect)
        queue.async { [metadataOutput] in
            metadataOutput.rectOfInterest = converted
        }
    }

    func capturePhoto() async throws -> UIImage {
        try await withCheckedThrowingContinuation { continuation in
            photoContinuation = continuation
            let settings = AVCapturePhotoSettings()
            photoOutput.capturePhoto(with: settings, delegate: self)
        }
    }

    enum CameraError: LocalizedError {
        case noDevice
        case captureFailed

        var errorDescription: String? {
            switch self {
            case .noDevice: "카메라를 사용할 수 없어요."
            case .captureFailed: "사진을 찍지 못했어요."
            }
        }
    }
}

extension CameraSession: AVCaptureMetadataOutputObjectsDelegate {
    nonisolated func metadataOutput(
        _ output: AVCaptureMetadataOutput,
        didOutput metadataObjects: [AVMetadataObject],
        from connection: AVCaptureConnection
    ) {
        guard let object = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
              let value = object.stringValue else { return }
        Task { @MainActor in
            guard !didCapture else { return }
            didCapture = true
            stop()
            onBarcode?(value)
        }
    }
}

extension CameraSession: AVCapturePhotoCaptureDelegate {
    nonisolated func photoOutput(
        _ output: AVCapturePhotoOutput,
        didFinishProcessingPhoto photo: AVCapturePhoto,
        error: Error?
    ) {
        Task { @MainActor in
            guard let continuation = photoContinuation else { return }
            photoContinuation = nil
            if let error {
                continuation.resume(throwing: error)
            } else if let data = photo.fileDataRepresentation(), let image = UIImage(data: data) {
                continuation.resume(returning: image)
            } else {
                continuation.resume(throwing: CameraError.captureFailed)
            }
        }
    }
}

/// 영수증 안의 작은 창에 들어가는 프리뷰. `resizeAspectFill` 로 채운다.
struct CameraPreview: UIViewRepresentable {
    let session: CameraSession
    /// 레이어가 자리잡은 뒤 관심영역을 다시 계산하기 위한 콜백.
    var onLayout: ((AVCaptureVideoPreviewLayer) -> Void)?

    func makeUIView(context: Context) -> PreviewView {
        let view = PreviewView()
        view.backgroundColor = .clear
        view.previewLayer.session = session.session
        view.previewLayer.videoGravity = .resizeAspectFill
        view.onLayout = onLayout
        return view
    }

    func updateUIView(_ uiView: PreviewView, context: Context) {
        uiView.onLayout = onLayout
    }

    final class PreviewView: UIView {
        override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
        var previewLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
        var onLayout: ((AVCaptureVideoPreviewLayer) -> Void)?

        override func layoutSubviews() {
            super.layoutSubviews()
            onLayout?(previewLayer)
        }
    }
}
