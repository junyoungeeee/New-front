import SwiftUI

// design.pen 의 변수를 그대로 옮긴 값. 이름도 원본을 따른다.
extension Color {
    init(hex: UInt32, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: alpha
        )
    }

    // 배경
    static let canvas     = Color(hex: 0xE4DED6)
    static let canvasDark = Color(hex: 0x241F1D)
    static let paper      = Color(hex: 0xF8F6F3)
    static let paperCard  = Color(hex: 0xFFFDFB)
    static let paperShade = Color(hex: 0xEFEAE4)
    static let line       = Color(hex: 0xDED7D0)

    // 텍스트
    static let ink  = Color(hex: 0x191817)
    static let ink2 = Color(hex: 0x55504B)
    static let ink3 = Color(hex: 0x9A938C)

    // 브랜드
    static let pink          = Color(hex: 0xE8427E)
    static let pinkTint      = Color(hex: 0xFBDDE9)
    static let pinkFaint     = Color(hex: 0xFDF1F6)
    static let pinkSoft      = Color(hex: 0xF08CB4)
    static let pinkPress     = Color(hex: 0xC72E64)
    static let pinkGlass     = Color(hex: 0xE8427E, alpha: 0.19)
    static let pinkGlassEdge = Color(hex: 0xE8427E, alpha: 0.48)

    // 아이콘 · 유리 테두리 (반투명)
    static let iconPink    = Color(hex: 0xE8427E, alpha: 0.72)
    static let iconInk     = Color(hex: 0x191817, alpha: 0.65)
    static let iconOnPink  = Color(hex: 0xFFFFFF, alpha: 0.67)
    static let inkGlass    = Color(hex: 0x191817, alpha: 0.05)
    static let inkGlassEdge = Color(hex: 0x191817, alpha: 0.35)
}

enum Radius {
    static let sm: CGFloat = 8
    static let md: CGFloat = 14
    static let full: CGFloat = 999
}

/// 서체 규칙.
///
/// Archivo·Space Mono 에는 한글 글리프가 없다. 한글 문장이 통째로 들어가는 `body` 는
/// 시스템 서체(한글은 Apple SD Gothic Neo)로 명시해 기기마다 결과가 달라지는 것을 막는다.
/// `mono` 는 대부분 영문·숫자 스탬프라 Space Mono 를 쓰고, 섞여 있는 한글만 시스템 폰트로
/// 대체되도록 둔다 — 디자인 원본이 보여주는 모습과 같다.
enum Typo {
    static func display(_ size: CGFloat, bold: Bool = true) -> Font {
        .custom(bold ? "Archivo-Bold" : "Archivo-Regular", fixedSize: size)
    }

    static func mono(_ size: CGFloat, bold: Bool = false) -> Font {
        .custom(bold ? "SpaceMono-Bold" : "SpaceMono-Regular", fixedSize: size)
    }

    static func body(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight)
    }
}
