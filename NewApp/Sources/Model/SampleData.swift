import SwiftData
import UIKit

/// 마일스톤 1·2 는 카메라 없이 시뮬레이터에서 확인한다.
/// 바코드 없이도 S03·S07 이 실데이터로 뜨도록 첫 실행에 더미를 넣는다.
enum SampleData {
    private struct Seed {
        var barcode: String
        var name: String
        var category: Category
        var asset: String?
        var reviews: [(Int, String, [String], Int)]   // 별점, 본문, 키워드, 며칠 전
    }

    private static let seeds: [Seed] = [
        Seed(
            barcode: "8801234567890",
            name: "대파 육개장면",
            category: .ramen,
            asset: "daepa-ramen",
            reviews: [
                (5, "대파 향이 진짜 진해요.\n국물이 칼칼하고 시원합니다!", ["국물이 진해요", "해장용"], 5),
                (4, "육개장 국물에 대파가 듬뿍이라\n해장으로 딱이에요.", ["해장용"], 12),
                (5, "면발이 쫄깃하고 대파블럭이 실해요.\n재구매 의사 100%입니다!", ["재구매"], 21),
                (3, "생각보다 안 맵고 순한 편이에요.\n계란 풀어 먹으면 더 맛있어요.", [], 30),
            ]
        ),
        Seed(
            barcode: "8801234567891",
            name: "제주 똣똣라면",
            category: .ramen,
            asset: "jeju-ramen",
            reviews: [
                (4, "국물이 담백하고 깔끔해요.\n짜지 않아서 좋았습니다.", ["가성비"], 3),
                (5, "제주 느낌 물씬 나는 맛이에요.\n선물용으로도 괜찮아요.", ["재구매"], 9),
            ]
        ),
        Seed(
            barcode: "8801234567892",
            name: "초코 쿠키샌드",
            category: .snack,
            asset: nil,
            reviews: [
                (4, "달지 않고 초코가 진해요.", ["달아요"], 2),
            ]
        ),
    ]

    static func seedIfNeeded(_ context: ModelContext) {
        let existing = try? context.fetch(FetchDescriptor<Product>())
        guard existing?.isEmpty ?? true else { return }

        for seed in seeds {
            // 번들에 넣어둔 누끼 PNG 를 실제 저장 경로로 옮긴다 — 앱이 쓰는 경로와 같게 만든다.
            var filename: String?
            if let asset = seed.asset,
               let url = Bundle.main.url(forResource: asset, withExtension: "png"),
               let image = UIImage(contentsOfFile: url.path) {
                filename = try? PhotoStore.save(image, barcode: seed.barcode)
            }

            let product = Product(
                barcode: seed.barcode,
                name: seed.name,
                category: seed.category,
                photoFilename: filename,
                photoIsCutout: filename != nil,
                createdAt: Date.now.addingTimeInterval(-Double(seeds.count) * 86_400)
            )
            context.insert(product)

            for (rating, body, keywords, daysAgo) in seed.reviews {
                let review = Review(
                    rating: rating,
                    body: body,
                    keywords: keywords,
                    createdAt: Date.now.addingTimeInterval(-Double(daysAgo) * 86_400)
                )
                review.product = product
                context.insert(review)
            }
        }

        try? context.save()
    }
}
