import Foundation
import SwiftData

enum Category: String, Codable, CaseIterable, Identifiable {
    case ramen = "라면"
    case snack = "과자"
    case drink = "음료"
    case iceCream = "아이스크림"
    case coffee = "커피"
    case etc = "기타"

    var id: String { rawValue }
}

@Model
final class Product {
    /// 자연키. UUID 를 주키로 두면 나중에 서버를 붙일 때 같은 제품이 사람마다
    /// 다른 행으로 생겨 병합이 지옥이 된다.
    @Attribute(.unique) var barcode: String
    var name: String
    var categoryRaw: String
    /// 파일명만. 이미지 자체는 Documents/products/ 에 있다.
    var photoFilename: String?
    /// 배경 제거가 실제로 성공했는지. 폴백으로 처리된 사진을 나중에 다시 찾기 위한 표시.
    var photoIsCutout: Bool
    var createdAt: Date

    @Relationship(deleteRule: .cascade, inverse: \Review.product)
    var reviews: [Review] = []

    init(
        barcode: String,
        name: String,
        category: Category,
        photoFilename: String? = nil,
        photoIsCutout: Bool = false,
        createdAt: Date = .now
    ) {
        self.barcode = barcode
        self.name = name
        self.categoryRaw = category.rawValue
        self.photoFilename = photoFilename
        self.photoIsCutout = photoIsCutout
        self.createdAt = createdAt
    }

    var category: Category { Category(rawValue: categoryRaw) ?? .etc }
    var reviewCount: Int { reviews.count }
    var averageRating: Double {
        reviews.isEmpty ? 0 : Double(reviews.map(\.rating).reduce(0, +)) / Double(reviews.count)
    }
}

@Model
final class Review {
    var rating: Int          // 1...5
    var body: String
    var keywords: [String]
    var createdAt: Date
    var product: Product?

    init(rating: Int, body: String, keywords: [String] = [], createdAt: Date = .now) {
        self.rating = rating
        self.body = body
        self.keywords = keywords
        self.createdAt = createdAt
    }
}

extension Date {
    /// "5일 전" 처럼 리뷰 목록에 붙는 짧은 표기.
    var shortRelative: String {
        let seconds = Date.now.timeIntervalSince(self)
        let minutes = Int(seconds / 60)
        let hours = minutes / 60
        let days = hours / 24
        if days >= 30 { return "\(days / 30)달 전" }
        if days >= 1 { return "\(days)일 전" }
        if hours >= 1 { return "\(hours)시간 전" }
        if minutes >= 1 { return "\(minutes)분 전" }
        return "방금"
    }
}
