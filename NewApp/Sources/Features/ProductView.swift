import SwiftData
import SwiftUI

/// S03 제품 — 제품 정보 + 리뷰 목록. `리뷰 쓰기` 는 S06 을 리뷰 전용 모드로 연다.
struct ProductView: View {
    let barcode: String
    var onBack: () -> Void

    @Query private var products: [Product]
    @State private var writingReview = false

    init(barcode: String, onBack: @escaping () -> Void) {
        self.barcode = barcode
        self.onBack = onBack
        _products = Query(filter: #Predicate<Product> { $0.barcode == barcode })
    }

    private var product: Product? { products.first }

    var body: some View {
        ReceiptScreen {
            ReceiptPaper {
                if let product {
                    content(for: product)
                } else {
                    Text("제품을 찾을 수 없어요")
                        .font(Typo.body(14, weight: .bold))
                        .foregroundStyle(Color.ink2)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 60)
                }
            }
        }
        .fullScreenCover(isPresented: $writingReview) {
            if let product {
                RegisterReviewView(mode: .reviewOnly(product)) { _ in
                    writingReview = false
                } onCancel: {
                    writingReview = false
                }
            }
        }
    }

    @ViewBuilder
    private func content(for product: Product) -> some View {
        let reviews = product.reviews.sorted { $0.createdAt > $1.createdAt }

        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Button(action: onBack) {
                    Text("Review")
                        .font(Typo.display(40))
                        .tracking(-1.4)
                        .foregroundStyle(Color.pink)
                }
                .buttonStyle(.plain)
                Spacer()
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundStyle(Color.iconPink)
            }

            Spacer().frame(height: 20)
            PerforationLine()
            Spacer().frame(height: 26)

            ProductPhoto(filename: product.photoFilename)
                .frame(height: 175)
                .frame(maxWidth: .infinity)

            Spacer().frame(height: 22)

            Text(product.name)
                .font(Typo.body(23, weight: .heavy))
                .foregroundStyle(Color.pink)
                .frame(maxWidth: .infinity, alignment: .leading)

            Spacer().frame(height: 13)

            HStack(spacing: 9) {
                StarRating(rating: product.averageRating, size: 19, spacing: 5)
                Text("(\(product.reviewCount))")
                    .font(Typo.body(14, weight: .medium))
                    .foregroundStyle(Color.pink)
            }

            Spacer().frame(height: 24)
            PerforationLine()
            Spacer().frame(height: 22)

            HStack {
                Text("REVIEWS")
                    .font(Typo.display(15))
                    .tracking(0.6)
                    .foregroundStyle(Color.pink)
                Spacer()
                Button { writingReview = true } label: {
                    HStack(spacing: 5) {
                        Text("리뷰 쓰기")
                            .font(Typo.body(11.5, weight: .bold))
                            .foregroundStyle(Color.pink)
                        Image(systemName: "pencil.line")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(Color.iconPink)
                    }
                    .padding(.vertical, 6)
                    .padding(.horizontal, 12)
                    .background(Color.pinkGlass, in: Capsule())
                    .overlay(Capsule().stroke(Color.pinkGlassEdge, lineWidth: 1))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("writeReview")
            }

            Spacer().frame(height: 8)

            if reviews.isEmpty {
                Text("아직 리뷰가 없어요. 첫 리뷰를 남겨보세요.")
                    .font(Typo.body(13))
                    .foregroundStyle(Color.ink3)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 24)
            } else {
                ForEach(Array(reviews.enumerated()), id: \.element.persistentModelID) { index, review in
                    if index > 0 {
                        DottedLine(thickness: 1.5, color: .pinkTint)
                    }
                    ReviewRow(review: review)
                }
            }
        }
        .padding(.top, 52)
        .padding(.horizontal, 26)
        .padding(.bottom, 24)
    }
}

struct ReviewRow: View {
    let review: Review

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(spacing: 7) {
                StarRating(rating: Double(review.rating), size: 12)
                Text("· \(review.createdAt.shortRelative)")
                    .font(Typo.body(11.5))
                    .foregroundStyle(Color.ink2)
            }

            if !review.body.isEmpty {
                Text(review.body)
                    .font(Typo.body(13))
                    .lineSpacing(13 * 0.65)
                    .foregroundStyle(Color.ink)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            if !review.keywords.isEmpty {
                HStack(spacing: 6) {
                    ForEach(review.keywords, id: \.self) { keyword in
                        Text(keyword)
                            .font(Typo.body(11, weight: .medium))
                            .foregroundStyle(Color.ink2)
                            .padding(.vertical, 5)
                            .padding(.horizontal, 10)
                            .background(Color.paperCard, in: Capsule())
                            .overlay(Capsule().stroke(Color.line, lineWidth: 1))
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 15)
    }
}
