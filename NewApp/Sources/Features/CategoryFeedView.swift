import SwiftData
import SwiftUI

/// S07 카테고리 스크롤 — 헤더 슬립 한 장 + 제품 슬립들이 프린터에서 계속 뽑혀 나온다.
struct CategoryFeedView: View {
    let category: Category
    var onBack: () -> Void
    var onProduct: (Product) -> Void

    @Query private var products: [Product]

    init(category: Category, onBack: @escaping () -> Void, onProduct: @escaping (Product) -> Void) {
        self.category = category
        self.onBack = onBack
        self.onProduct = onProduct
        let raw = category.rawValue
        _products = Query(
            filter: #Predicate<Product> { $0.categoryRaw == raw },
            sort: \Product.createdAt,
            order: .reverse
        )
    }

    var body: some View {
        ReceiptScreen {
            VStack(spacing: 18) {
                headerSlip

                if products.isEmpty {
                    emptySlip
                } else {
                    ForEach(products) { product in
                        Button { onProduct(product) } label: {
                            ProductSlip(product: product)
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("product-\(product.barcode)")
                    }
                }
            }
        }
    }

    /// 프린터에서 막 나온 첫 장이라 윗면 절취선이 없다.
    private var headerSlip: some View {
        ReceiptPaper {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Button(action: onBack) {
                        HStack(spacing: 8) {
                            Image(systemName: "chevron.left")
                                .font(.system(size: 18, weight: .medium))
                                .foregroundStyle(Color.iconInk)
                            Text(category.rawValue)
                                .font(Typo.body(24, weight: .heavy))
                                .foregroundStyle(Color.ink)
                        }
                    }
                    .buttonStyle(.plain)
                    Spacer()
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundStyle(Color.iconPink)
                }

                Spacer().frame(height: 16)
                PerforationLine()
                Spacer().frame(height: 14)

                HStack {
                    Text("\(products.count) ITEMS")
                        .font(Typo.mono(11, bold: true))
                        .tracking(2)
                        .foregroundStyle(Color.pink)
                    Spacer()
                    HStack(spacing: 4) {
                        Text("최신순")
                            .font(Typo.body(12))
                            .foregroundStyle(Color.ink3)
                        Image(systemName: "chevron.down")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(Color.iconInk)
                    }
                }
            }
            .padding(.top, 46)
            .padding(.horizontal, 26)
            .padding(.bottom, 20)
        }
    }

    private var emptySlip: some View {
        ReceiptPaper(tornTop: true) {
            VStack(spacing: 10) {
                Text("아직 등록된 제품이 없어요")
                    .font(Typo.body(14, weight: .bold))
                    .foregroundStyle(Color.ink)
                Text("바코드를 찍어 첫 제품을 등록해보세요.")
                    .font(Typo.body(12.5))
                    .foregroundStyle(Color.ink3)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 44)
            .padding(.horizontal, 26)
        }
    }
}

/// 제품 한 장. 사진 · 이름 · 별점 · 바코드.
struct ProductSlip: View {
    let product: Product

    var body: some View {
        ReceiptPaper(tornTop: true) {
            VStack(alignment: .leading, spacing: 0) {
                ProductPhoto(filename: product.photoFilename)
                    .frame(height: 148)
                    .frame(maxWidth: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: 4))

                Spacer().frame(height: 16)

                Text(product.name)
                    .font(Typo.body(19, weight: .heavy))
                    .foregroundStyle(Color.ink)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Spacer().frame(height: 10)

                HStack(spacing: 8) {
                    StarRating(rating: product.averageRating)
                    Text("(\(product.reviewCount))")
                        .font(Typo.mono(12))
                        .foregroundStyle(Color.pink)
                }

                Spacer().frame(height: 16)
                PerforationLine()
                Spacer().frame(height: 14)

                BarcodeView(height: 34)
                    .frame(maxWidth: .infinity)
            }
            .padding(.top, 22)
            .padding(.horizontal, 26)
            .padding(.bottom, 20)
        }
    }
}

/// 저장된 누끼 PNG. 없으면 종이 톤의 빈 자리를 둔다.
struct ProductPhoto: View {
    let filename: String?

    var body: some View {
        if let image = PhotoStore.load(filename) {
            Image(uiImage: image)
                .resizable()
                .scaledToFit()
        } else {
            ZStack {
                Color.paperShade
                Image(systemName: "photo")
                    .font(.system(size: 22))
                    .foregroundStyle(Color.ink3)
            }
        }
    }
}
