import SwiftUI
import AVFoundation
import PhotosUI

/// S05 제품 사진 — 촬영 → 누끼 → S06 으로 이미지 전달.
///
/// 사진이 필수라 이 화면에는 우회로가 없다. 권한을 거부했을 때는 설정으로 가는 길과
/// 사진첩에서 고르는 길을 열어둔다.
struct ProductPhotoView: View {
    let barcode: String
    var onCaptured: (ScanFlow.PhotoPayload) -> Void
    var onCancel: () -> Void

    @StateObject private var camera = CameraSession(mode: .photo)
    @State private var isProcessing = false
    @State private var errorMessage: String?
    @State private var pickingFromLibrary = false

    /// 촬영 가이드 창. 이 영역이 그대로 누끼의 크롭 기준이 된다.
    private let windowHeight: CGFloat = 210

    var body: some View {
        ReceiptScreen(dark: true, scrolls: false) {
            ReceiptPaper {
                VStack(alignment: .leading, spacing: 0) {
                    ReceiptHeader(trailingIcon: "xmark", action: onCancel)

                    Spacer().frame(height: 20)
                    PerforationLine()
                    Spacer().frame(height: 20)

                    Text("STEP 1 · 제품 사진")
                        .font(Typo.mono(11, bold: true))
                        .tracking(2.2)
                        .foregroundStyle(Color.pink)
                        .frame(maxWidth: .infinity)

                    Spacer().frame(height: 14)

                    cameraWindow

                    Spacer().frame(height: 18)

                    Text(title)
                        .font(Typo.body(13.5, weight: .bold))
                        .foregroundStyle(Color.ink)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)

                    Spacer().frame(height: 8)

                    Text(subtitle)
                        .font(Typo.body(12))
                        .foregroundStyle(Color.ink3)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)

                    Spacer().frame(height: 22)

                    shutterRow
                }
                .padding(.top, 52)
                .padding(.horizontal, 26)
                .padding(.bottom, 26)
            }
        }
        .preferredColorScheme(.dark)
        .task { await camera.start() }
        .onDisappear { camera.stop() }
        .photosPicker(isPresented: $pickingFromLibrary, selection: $pickedItem, matching: .images)
        .onChange(of: pickedItem) { _, item in
            guard let item else { return }
            Task { await useLibraryImage(item) }
        }
    }

    @State private var pickedItem: PhotosPickerItem?

    private var title: String {
        if isProcessing { return "배경을 지우는 중이에요" }
        if case .denied = camera.status { return "카메라 권한이 꺼져 있어요" }
        if let errorMessage { return errorMessage }
        return "제품 앞면이 잘 보이게 담아주세요"
    }

    private var subtitle: String {
        if case .denied = camera.status { return "설정에서 허용하거나 사진첩에서 고를 수 있어요" }
        return "배경은 자동으로 지워집니다"
    }

    private var cameraWindow: some View {
        ZStack {
            Color(hex: 0x26221F)

            if camera.status == .running {
                CameraPreview(session: camera)
            } else if case .denied = camera.status {
                Image(systemName: "camera.fill")
                    .font(.system(size: 26))
                    .foregroundStyle(Color.iconOnPink)
            }

            if isProcessing {
                Color.black.opacity(0.45)
                ProgressView().tint(.white)
            }

            ScanBrackets(arm: 28)
        }
        .frame(height: windowHeight)
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }

    private var shutterRow: some View {
        VStack(spacing: 14) {
            if camera.status == .running {
                Button {
                    Task { await capture() }
                } label: {
                    ZStack {
                        Circle()
                            .strokeBorder(Color.pinkGlassEdge, lineWidth: 2.5)
                            .frame(width: 66, height: 66)
                        Circle()
                            .fill(Color.pinkGlass)
                            .overlay(Circle().stroke(Color.pinkGlassEdge, lineWidth: 1))
                            .frame(width: 50, height: 50)
                    }
                }
                .buttonStyle(.plain)
                .disabled(isProcessing)
            }

            // 권한을 거부했거나 촬영을 취소하면 등록 자체가 막히므로 대안을 남긴다.
            HStack(spacing: 16) {
                if case .denied = camera.status {
                    Button("설정 열기") {
                        if let url = URL(string: UIApplication.openSettingsURLString) {
                            UIApplication.shared.open(url)
                        }
                    }
                    .font(Typo.body(13, weight: .bold))
                    .foregroundStyle(Color.pink)
                }
                Button("사진첩에서 고르기") { pickingFromLibrary = true }
                    .font(Typo.body(13, weight: .medium))
                    .foregroundStyle(Color.ink3)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func capture() async {
        isProcessing = true
        errorMessage = nil
        defer { isProcessing = false }
        do {
            let photo = try await camera.capturePhoto()
            await process(photo)
        } catch {
            errorMessage = "사진을 찍지 못했어요. 다시 시도해주세요."
        }
    }

    private func useLibraryImage(_ item: PhotosPickerItem) async {
        isProcessing = true
        defer { isProcessing = false; pickedItem = nil }
        guard let data = try? await item.loadTransferable(type: Data.self),
              let image = UIImage(data: data) else {
            errorMessage = "사진을 불러오지 못했어요."
            return
        }
        await process(image)
    }

    /// 가이드 창이 화면에서 차지하는 비율을 원본 픽셀로 옮겨 크롭 사각형을 만든다.
    /// 프리뷰가 `resizeAspectFill` 이라 짧은 축을 기준으로 맞춰야 실제로 보이던 영역과 같아진다.
    private func process(_ photo: UIImage) async {
        let normalized = photo.normalizedUp()
        let guideRect = guideRectInPixels(for: normalized)
        let result = Cutout.perform(on: normalized, guideRect: guideRect)
        do {
            let filename = try PhotoStore.save(result.image, barcode: barcode)
            onCaptured(.init(filename: filename, isCutout: result.isCutout))
        } catch {
            errorMessage = "사진을 저장하지 못했어요."
        }
    }

    private func guideRectInPixels(for image: UIImage) -> CGRect {
        guard let cg = image.cgImage else { return .zero }
        let pixelWidth = CGFloat(cg.width)
        let pixelHeight = CGFloat(cg.height)

        // 화면에서 창의 비율 (창 폭은 영수증 안쪽 248pt)
        let windowAspect = 248.0 / windowHeight
        let imageAspect = pixelWidth / pixelHeight

        var cropWidth = pixelWidth
        var cropHeight = pixelHeight
        if imageAspect > windowAspect {
            // 원본이 더 넓다 — 높이를 다 쓰고 폭을 잘라낸다
            cropWidth = pixelHeight * windowAspect
        } else {
            cropHeight = pixelWidth / windowAspect
        }

        return CGRect(
            x: (pixelWidth - cropWidth) / 2,
            y: (pixelHeight - cropHeight) / 2,
            width: cropWidth,
            height: cropHeight
        )
    }
}

extension UIImage {
    /// EXIF 회전을 픽셀에 실제로 적용한다. Vision 은 방향 정보를 안 보고 픽셀을 그대로 읽는다.
    func normalizedUp() -> UIImage {
        guard imageOrientation != .up else { return self }
        let format = UIGraphicsImageRendererFormat()
        format.scale = scale
        format.opaque = false
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in
            draw(in: CGRect(origin: .zero, size: size))
        }
    }
}
