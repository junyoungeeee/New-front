import SwiftData
import SwiftUI

/// S01 홈 — 카테고리별 제품 수를 집계해 영수증 표로 보여준다.
struct HomeView: View {
    @Query private var products: [Product]

    var onCategory: (Category) -> Void
    var onScan: () -> Void

    private func count(_ category: Category) -> Int {
        products.filter { $0.categoryRaw == category.rawValue }.count
    }

    var body: some View {
        ReceiptScreen {
            ReceiptPaper {
                VStack(alignment: .leading, spacing: 0) {
                    HStack {
                        Text("New.")
                            .font(Typo.display(36))
                            .tracking(-1.2)
                            .foregroundStyle(Color.pink)
                        Spacer()
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 21, weight: .medium))
                            .foregroundStyle(Color.iconPink)
                            .frame(width: 26, height: 26)
                    }

                    Spacer().frame(height: 26)
                    PerforationLine()
                    Spacer().frame(height: 34)

                    HStack {
                        Text("Item")
                        Spacer()
                        Text("Review")
                    }
                    .font(Typo.display(17))
                    .foregroundStyle(Color.pink)

                    Spacer().frame(height: 9)
                    Rectangle().fill(Color.pink).frame(height: 1.5)

                    ForEach(Array(Category.allCases.enumerated()), id: \.element) { index, category in
                        if index > 0 {
                            DottedLine()
                        }
                        Button {
                            onCategory(category)
                        } label: {
                            HStack {
                                Text(category.rawValue)
                                    .font(Typo.body(18, weight: .bold))
                                    .foregroundStyle(Color.ink)
                                Spacer()
                                HStack(spacing: 8) {
                                    Text("\(count(category))")
                                        .font(Typo.mono(13))
                                        .foregroundStyle(Color.ink3)
                                    Image(systemName: "chevron.right")
                                        .font(.system(size: 15, weight: .medium))
                                        .foregroundStyle(Color.iconPink)
                                }
                            }
                            .padding(.vertical, 24)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("category-\(category.rawValue)")
                    }

                    Spacer().frame(height: 12)
                    Rectangle().fill(Color.pink).frame(height: 1.5)
                    Spacer().frame(height: 32)

                    scanBlock
                }
                .padding(.top, 52)
                .padding(.horizontal, 26)
                .padding(.bottom, 34)
            }
        }
    }

    private var scanBlock: some View {
        Button(action: onScan) {
            VStack(spacing: 0) {
                BarcodeView(height: 70)
                    .padding(.top, 18)
                Spacer(minLength: 8)
                Text("TAP BARCODE TO SCAN")
                    .font(Typo.mono(11, bold: true))
                    .tracking(2.2)
                    .foregroundStyle(Color.ink)
                    .padding(.bottom, 8)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 118)
            .overlay(ScanBrackets(arm: 24))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("scanBlock")
    }
}
