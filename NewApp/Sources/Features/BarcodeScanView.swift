import SwiftUI
import AVFoundation

/// S02 바코드 스캔 — 프리뷰가 영수증 안의 248×206 창에만 보인다.
struct BarcodeScanView: View {
    var onFound: (String) -> Void
    var onCancel: () -> Void

    @StateObject private var camera = CameraSession(mode: .barcode)
    @State private var manualEntry = false
    @State private var manualCode = ""
    @State private var scanLineDown = false

    var body: some View {
        ReceiptScreen(dark: true, scrolls: false) {
            ReceiptPaper {
                VStack(alignment: .leading, spacing: 0) {
                    ReceiptHeader(trailingIcon: "xmark", action: onCancel)

                    Spacer().frame(height: 20)
                    PerforationLine()
                    Spacer().frame(height: 22)

                    Text("SCAN MODE")
                        .font(Typo.mono(11, bold: true))
                        .tracking(2.4)
                        .foregroundStyle(Color.pink)
                        .frame(maxWidth: .infinity)

                    Spacer().frame(height: 14)

                    cameraWindow

                    Spacer().frame(height: 18)

                    Text(statusTitle)
                        .font(Typo.body(13.5, weight: .bold))
                        .foregroundStyle(Color.ink)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)

                    Spacer().frame(height: 8)

                    Text(statusSubtitle)
                        .font(Typo.mono(10.5))
                        .tracking(2.4)
                        .foregroundStyle(Color.pink)
                        .frame(maxWidth: .infinity)

                    Spacer().frame(height: 24)
                    PerforationLine()
                    Spacer().frame(height: 20)

                    Button { manualEntry = true } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "keyboard")
                                .font(.system(size: 15, weight: .medium))
                                .foregroundStyle(Color.iconInk)
                            Text("바코드 번호 직접 입력")
                                .font(Typo.body(14, weight: .bold))
                                .foregroundStyle(Color.ink2)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .background(Color.inkGlass, in: Capsule())
                        .overlay(Capsule().stroke(Color.inkGlassEdge, lineWidth: 1.5))
                    }
                    .buttonStyle(.plain)
                }
                .padding(.top, 52)
                .padding(.horizontal, 26)
                .padding(.bottom, 26)
            }
        }
        .preferredColorScheme(.dark)   // 배경이 어두워 상태바를 밝게 강제한다
        .task { await camera.start() }
        .onDisappear { camera.stop() }
        .onAppear {
            camera.onBarcode = onFound
            withAnimation(.easeInOut(duration: 1.4).repeatForever(autoreverses: true)) {
                scanLineDown = true
            }
        }
        .alert("바코드 번호 입력", isPresented: $manualEntry) {
            TextField("8801234567890", text: $manualCode)
                .keyboardType(.numberPad)
            Button("취소", role: .cancel) { manualCode = "" }
            Button("확인") {
                let code = manualCode.trimmingCharacters(in: .whitespaces)
                manualCode = ""
                if !code.isEmpty { onFound(code) }
            }
        }
    }

    private var statusTitle: String {
        switch camera.status {
        case .denied: "카메라 권한이 꺼져 있어요"
        case .failed(let message): message
        default: "바코드를 사각형 안에 맞춰주세요"
        }
    }

    private var statusSubtitle: String {
        switch camera.status {
        case .denied: "설정에서 허용해주세요"
        case .running: "SEARCHING…"
        default: "READY"
        }
    }

    private var cameraWindow: some View {
        ZStack {
            Color(hex: 0x221E1C)

            if camera.status == .running {
                CameraPreview(session: camera) { layer in
                    // 창 밖 바코드를 잡지 않도록 관심영역을 창 전체로 제한한다.
                    camera.setRegionOfInterest(layer.bounds, in: layer)
                }
            } else if case .denied = camera.status {
                permissionFallback
            }

            // 스캔 라인
            if camera.status == .running {
                Rectangle()
                    .fill(Color.pink)
                    .frame(height: 2)
                    .shadow(color: Color(hex: 0xE8427E, alpha: 0.5), radius: 7)
                    .padding(.horizontal, 24)
                    .offset(y: scanLineDown ? 70 : -70)
            }

            ScanBrackets(arm: 28)
        }
        .frame(height: 206)
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }

    /// 권한을 거부하면 스캔이 막히므로 설정으로 가는 길을 열어둔다.
    private var permissionFallback: some View {
        VStack(spacing: 12) {
            Image(systemName: "camera.fill")
                .font(.system(size: 26))
                .foregroundStyle(Color.iconOnPink)
            Button("설정 열기") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
            .font(Typo.body(13, weight: .bold))
            .foregroundStyle(Color.pink)
        }
    }
}
