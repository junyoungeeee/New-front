import SwiftUI

/// S04 없는 제품 — 스캔은 됐지만 등록된 게 없을 때. CTA 는 곧바로 S05 로.
struct NotFoundView: View {
    let barcode: String
    var onRegister: () -> Void
    var onRescan: () -> Void
    var onCancel: () -> Void

    var body: some View {
        ReceiptScreen(scrolls: false) {
            ReceiptPaper {
                VStack(alignment: .leading, spacing: 0) {
                    ReceiptHeader(trailingIcon: "xmark", action: onCancel)

                    Spacer().frame(height: 20)
                    PerforationLine()
                    Spacer().frame(height: 24)

                    Text("NO MATCH FOUND")
                        .font(Typo.mono(12.5, bold: true))
                        .tracking(2.4)
                        .foregroundStyle(Color.pink)
                        .frame(maxWidth: .infinity)

                    Spacer().frame(height: 16)

                    BarcodeView(height: 62)
                        .frame(maxWidth: .infinity)

                    Spacer().frame(height: 10)

                    Text(formatted(barcode))
                        .font(Typo.mono(11.5))
                        .tracking(2)
                        .foregroundStyle(Color.ink2)
                        .frame(maxWidth: .infinity)

                    Spacer().frame(height: 24)
                    PerforationLine()
                    Spacer().frame(height: 24)

                    Text("아직 등록되지 않은\n제품이에요")
                        .font(Typo.body(20, weight: .heavy))
                        .lineSpacing(20 * 0.45)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(Color.ink)
                        .frame(maxWidth: .infinity)

                    Spacer().frame(height: 10)

                    Text("가장 먼저 이 제품을 등록하고\n첫 번째 리뷰를 남겨보세요.")
                        .font(Typo.body(13))
                        .lineSpacing(13 * 0.75)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(Color.ink2)
                        .frame(maxWidth: .infinity)

                    Spacer().frame(height: 26)

                    GlassButton(icon: "plus", title: "제품 등록하고 리뷰 쓰기", action: onRegister)

                    Spacer().frame(height: 14)

                    Button(action: onRescan) {
                        HStack(spacing: 6) {
                            Image(systemName: "arrow.counterclockwise")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(Color.iconInk)
                            Text("다시 스캔하기")
                                .font(Typo.body(13, weight: .medium))
                                .foregroundStyle(Color.ink3)
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.top, 52)
                .padding(.horizontal, 26)
                .padding(.bottom, 26)
            }
        }
    }

    /// EAN-13 을 "8 801234 567890" 처럼 끊어 읽는다.
    private func formatted(_ code: String) -> String {
        guard code.count == 13 else { return code }
        let chars = Array(code)
        return "\(chars[0]) \(String(chars[1...6])) \(String(chars[7...12]))"
    }
}
