import SwiftData
import SwiftUI

/// 스캔에서 시작하는 모달 흐름.
/// S02 → (있으면) 끝 / (없으면) S04 → S05 → S06 → 끝.
struct ScanFlow: View {
    /// 저장이 끝났거나 이미 있는 제품을 찾았을 때 바코드를 돌려준다.
    var onFinish: (String) -> Void
    var onCancel: () -> Void

    @Environment(\.modelContext) private var context
    @State private var step: Step = .scan

    enum Step: Hashable {
        case scan
        case notFound(String)
        case photo(String)
        case register(String, PhotoPayload)
    }

    /// 촬영 결과를 S06 으로 넘기기 위한 값.
    struct PhotoPayload: Hashable {
        var filename: String
        var isCutout: Bool
    }

    var body: some View {
        Group {
            switch step {
            case .scan:
                BarcodeScanView(
                    onFound: handleBarcode,
                    onCancel: onCancel
                )
            case .notFound(let barcode):
                NotFoundView(
                    barcode: barcode,
                    onRegister: { step = .photo(barcode) },
                    onRescan: { step = .scan },
                    onCancel: onCancel
                )
            case .photo(let barcode):
                ProductPhotoView(
                    barcode: barcode,
                    onCaptured: { payload in step = .register(barcode, payload) },
                    onCancel: onCancel
                )
            case .register(let barcode, let payload):
                RegisterReviewView(
                    mode: .register(barcode: barcode, photo: payload),
                    onSaved: { onFinish($0) },
                    onCancel: onCancel,
                    onRetake: { step = .photo(barcode) }
                )
            }
        }
        .animation(.easeInOut(duration: 0.25), value: step)
    }

    /// 한 번 등록한 바코드는 다음부터 자동으로 채워진다 — MVP 에서 "이미 등록된 제품"의 의미.
    private func handleBarcode(_ barcode: String) {
        let descriptor = FetchDescriptor<Product>(
            predicate: #Predicate { $0.barcode == barcode }
        )
        let existing = (try? context.fetch(descriptor))?.first
        if existing != nil {
            onFinish(barcode)
        } else {
            step = .notFound(barcode)
        }
    }
}
