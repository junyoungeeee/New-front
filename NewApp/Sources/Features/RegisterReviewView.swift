import SwiftData
import SwiftUI

/// S06 등록 + 리뷰.
///
/// 디자인에 "이미 등록된 제품에 리뷰만 추가"하는 화면이 없다. 화면을 새로 그리는 대신
/// 이 뷰를 두 모드로 쓴다 — 제품 정보 블록만 접었다 폈다 한다.
struct RegisterReviewView: View {
    enum Mode: Hashable {
        /// 신규 등록 — 사진·제품명·카테고리 입력 가능
        case register(barcode: String, photo: ScanFlow.PhotoPayload)
        /// 리뷰만 — 제품 정보는 읽기 전용 요약으로 접고 별점부터 시작
        case reviewOnly(Product)
    }

    let mode: Mode
    var onSaved: (String) -> Void
    var onCancel: () -> Void
    var onRetake: (() -> Void)? = nil

    @Environment(\.modelContext) private var context

    @State private var name = ""
    @State private var category: Category = .ramen
    @State private var rating = 0
    @State private var body_ = ""
    @State private var keywords: Set<String> = []

    private static let suggestedKeywords = [
        "국물이 진해요", "가성비", "해장용", "재구매", "자극적", "매워요", "달아요", "양이 많아요",
    ]

    private var isRegistering: Bool {
        if case .register = mode { return true }
        return false
    }

    private var canSave: Bool {
        rating > 0 && (!isRegistering || !name.trimmingCharacters(in: .whitespaces).isEmpty)
    }

    var body: some View {
        ReceiptScreen {
            ReceiptPaper {
                VStack(alignment: .leading, spacing: 0) {
                    ReceiptHeader(trailingIcon: "xmark", action: onCancel)

                    Spacer().frame(height: 20)
                    PerforationLine()
                    Spacer().frame(height: 20)

                    switch mode {
                    case .register(let barcode, let photo):
                        registerFields(barcode: barcode, photo: photo)
                    case .reviewOnly(let product):
                        reviewOnlyHeader(product)
                    }

                    Spacer().frame(height: 26)
                    PerforationLine()
                    Spacer().frame(height: 22)

                    StarRating(rating: Double(rating), size: 34, spacing: 7) { rating = $0 }
                        .frame(maxWidth: .infinity)

                    Spacer().frame(height: 20)

                    reviewEditor

                    Spacer().frame(height: 20)

                    Text("KEYWORD · 최대 3개")
                        .font(Typo.mono(10.5))
                        .tracking(1.6)
                        .foregroundStyle(Color.pink)

                    Spacer().frame(height: 10)

                    keywordChips

                    Spacer().frame(height: 28)

                    GlassButton(
                        icon: "printer",
                        title: isRegistering ? "등록하기" : "리뷰 남기기",
                        fontSize: 14.5,
                        action: save
                    )
                    .opacity(canSave ? 1 : 0.45)
                    .disabled(!canSave)
                }
                .padding(.top, 52)
                .padding(.horizontal, 26)
                .padding(.bottom, 26)
            }
        }
        .onAppear {
            if case .reviewOnly(let product) = mode {
                name = product.name
                category = product.category
            }
        }
    }

    // MARK: 신규 등록

    @ViewBuilder
    private func registerFields(barcode: String, photo: ScanFlow.PhotoPayload) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 5) {
                Text("NEW ITEM")
                    .font(Typo.mono(11, bold: true))
                    .tracking(2.2)
                    .foregroundStyle(Color.pink)
                Text(barcode)
                    .font(Typo.mono(13))
                    .tracking(0.8)
                    .foregroundStyle(Color.ink2)
            }
            Spacer()
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 18))
                .foregroundStyle(Color.iconPink)
        }

        Spacer().frame(height: 20)

        HStack(alignment: .top, spacing: 14) {
            ProductPhoto(filename: photo.filename)
                .frame(width: 96, height: 96)
                .clipShape(RoundedRectangle(cornerRadius: Radius.sm))

            VStack(alignment: .leading, spacing: 8) {
                // 폴백으로 처리됐으면 솔직하게 말한다. "지워집니다" 예고와 어긋나면 배신감이 든다.
                Text(photo.isCutout ? "배경이 제거된 사진이에요" : "배경은 그대로 두었어요")
                    .font(Typo.body(12.5))
                    .foregroundStyle(Color.ink2)
                    .fixedSize(horizontal: false, vertical: true)

                if let onRetake {
                    Button(action: onRetake) {
                        HStack(spacing: 5) {
                            Image(systemName: "arrow.counterclockwise")
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(Color.iconInk)
                            Text("다시 찍기")
                                .font(Typo.body(11.5, weight: .bold))
                                .foregroundStyle(Color.ink2)
                        }
                        .padding(.vertical, 7)
                        .padding(.horizontal, 13)
                        .background(Color.inkGlass, in: Capsule())
                        .overlay(Capsule().stroke(Color.inkGlassEdge, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }

        Spacer().frame(height: 22)

        VStack(alignment: .leading, spacing: 7) {
            Text("제품명 *")
                .font(Typo.mono(10.5))
                .tracking(1.6)
                .foregroundStyle(Color.pink)
            TextField("", text: $name, prompt: Text("예) 대파 육개장면").foregroundStyle(Color.ink3))
                .font(Typo.body(14))
                .foregroundStyle(Color.ink)
                .padding(.vertical, 10)
                .overlay(alignment: .bottom) {
                    Rectangle().fill(Color.ink).frame(height: 1.5)
                }
        }

        Spacer().frame(height: 22)

        Text("CATEGORY *")
            .font(Typo.mono(10.5))
            .tracking(1.6)
            .foregroundStyle(Color.pink)

        Spacer().frame(height: 10)

        FlowRows(items: Category.allCases, spacing: 7) { item in
            Chip(title: item.rawValue, selected: category == item) { category = item }
        }
    }

    // MARK: 리뷰 전용

    @ViewBuilder
    private func reviewOnlyHeader(_ product: Product) -> some View {
        HStack(alignment: .center, spacing: 14) {
            ProductPhoto(filename: product.photoFilename)
                .frame(width: 72, height: 72)
                .clipShape(RoundedRectangle(cornerRadius: Radius.sm))

            VStack(alignment: .leading, spacing: 5) {
                Text(product.category.rawValue)
                    .font(Typo.mono(10.5))
                    .tracking(1.6)
                    .foregroundStyle(Color.pink)
                Text(product.name)
                    .font(Typo.body(17, weight: .heavy))
                    .foregroundStyle(Color.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
    }

    // MARK: 공통

    private var reviewEditor: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack(alignment: .topLeading) {
                if body_.isEmpty {
                    Text("어떤 점이 좋았나요?\n맛, 가격, 재구매 의사 등 솔직한 후기를 남겨주세요.")
                        .font(Typo.body(13))
                        .lineSpacing(13 * 0.7)
                        .foregroundStyle(Color.ink3)
                        .allowsHitTesting(false)
                }
                TextEditor(text: $body_)
                    .font(Typo.body(13))
                    .foregroundStyle(Color.ink)
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: 76)
            }
            HStack {
                Spacer()
                Text("\(body_.count) / 500")
                    .font(Typo.mono(10.5))
                    .foregroundStyle(Color.ink3)
            }
        }
        .padding(13)
        .frame(height: 126)
        .background(Color.paperCard, in: RoundedRectangle(cornerRadius: Radius.sm))
        .overlay(RoundedRectangle(cornerRadius: Radius.sm).stroke(Color.line, lineWidth: 1))
        .onChange(of: body_) { _, value in
            if value.count > 500 { body_ = String(value.prefix(500)) }
        }
    }

    private var keywordChips: some View {
        FlowRows(items: Self.suggestedKeywords, spacing: 7) { keyword in
            Chip(title: keyword, selected: keywords.contains(keyword)) {
                if keywords.contains(keyword) {
                    keywords.remove(keyword)
                } else if keywords.count < 3 {
                    keywords.insert(keyword)
                }
            }
        }
    }

    private func save() {
        guard canSave else { return }
        let product: Product

        switch mode {
        case .register(let barcode, let photo):
            let created = Product(
                barcode: barcode,
                name: name.trimmingCharacters(in: .whitespaces),
                category: category,
                photoFilename: photo.filename,
                photoIsCutout: photo.isCutout
            )
            context.insert(created)
            product = created
        case .reviewOnly(let existing):
            product = existing
        }

        let review = Review(
            rating: rating,
            body: body_.trimmingCharacters(in: .whitespacesAndNewlines),
            keywords: Array(keywords)
        )
        review.product = product
        context.insert(review)

        try? context.save()
        onSaved(product.barcode)
    }
}

/// 알약들을 폭에 맞춰 줄바꿈한다. 디자인은 줄을 손으로 나눠뒀지만 내용이 늘면 넘친다.
struct FlowRows<Item: Hashable, Content: View>: View {
    let items: [Item]
    var spacing: CGFloat = 7
    @ViewBuilder var content: (Item) -> Content

    var body: some View {
        FlowLayout(spacing: spacing) {
            ForEach(items, id: \.self) { item in
                content(item)
            }
        }
    }
}

/// 실제 측정값으로 줄을 나누는 흐름 배치.
struct FlowLayout: Layout {
    var spacing: CGFloat = 7

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var rowWidth: CGFloat = 0
        var rowHeight: CGFloat = 0
        var total = CGSize(width: 0, height: 0)

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if rowWidth > 0, rowWidth + spacing + size.width > maxWidth {
                total.width = max(total.width, rowWidth)
                total.height += rowHeight + spacing
                rowWidth = size.width
                rowHeight = size.height
            } else {
                rowWidth += (rowWidth > 0 ? spacing : 0) + size.width
                rowHeight = max(rowHeight, size.height)
            }
        }
        total.width = max(total.width, rowWidth)
        total.height += rowHeight
        return total
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
