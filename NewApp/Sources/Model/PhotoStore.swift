import UIKit

/// 누끼 PNG 는 2000px 안팎이라 DB 에 넣으면 쿼리가 느려진다.
/// `Documents/products/<barcode>.png` 로 저장하고 파일명만 들고 있는다.
/// 파일명을 바코드로 통일해 두면 나중에 그대로 오브젝트 스토리지 키가 된다.
enum PhotoStore {
    static var directory: URL {
        let url = URL.documentsDirectory.appending(path: "products", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    static func url(for filename: String) -> URL {
        directory.appending(path: filename)
    }

    @discardableResult
    static func save(_ image: UIImage, barcode: String) throws -> String {
        let filename = "\(barcode).png"
        guard let data = image.pngData() else {
            throw CocoaError(.fileWriteUnknown)
        }
        try data.write(to: url(for: filename), options: .atomic)
        return filename
    }

    static func load(_ filename: String?) -> UIImage? {
        guard let filename else { return nil }
        return UIImage(contentsOfFile: url(for: filename).path)
    }

    static func delete(_ filename: String?) {
        guard let filename else { return }
        try? FileManager.default.removeItem(at: url(for: filename))
    }
}
