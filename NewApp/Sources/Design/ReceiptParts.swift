import SwiftUI

// MARK: - 절취면

/// 영수증의 톱니 가장자리. 원본은 폭 15 / 깊이 14 짜리 이빨 20개로 300pt 를 채운다.
///
/// 주의: 이 도형은 반드시 종이와 **분리해서** 그린다. 종이 프레임에 배경색을 칠하고
/// 그 위에 톱니를 얹으면 골 사이가 종이색으로 메워져 일자로 보인다.
struct TornEdge: Shape {
    /// true 면 위를 향한 톱니 (영수증 윗면 — S07 슬립)
    var pointingUp = false
    var toothWidth: CGFloat = 15
    var depth: CGFloat = 14

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let count = max(1, Int((rect.width / toothWidth).rounded()))
        let w = rect.width / CGFloat(count)
        let half = w / 2

        if pointingUp {
            // 아래쪽이 몸통, 위로 솟은 삼각형
            path.move(to: CGPoint(x: 0, y: depth))
            for i in 0..<count {
                let x = CGFloat(i) * w
                path.addLine(to: CGPoint(x: x + half, y: 0))
                path.addLine(to: CGPoint(x: x + w, y: depth))
            }
            path.addLine(to: CGPoint(x: rect.width, y: rect.height))
            path.addLine(to: CGPoint(x: 0, y: rect.height))
        } else {
            // 위쪽이 몸통, 아래로 늘어진 삼각형
            path.move(to: CGPoint(x: 0, y: 0))
            for i in 0..<count {
                let x = CGFloat(i) * w
                path.addLine(to: CGPoint(x: x + half, y: depth))
                path.addLine(to: CGPoint(x: x + w, y: 0))
            }
        }
        path.closeSubpath()
        return path
    }
}

// MARK: - 구분선

/// 굵은 핑크 대시 13개. 영수증 안의 구역을 나눈다.
struct PerforationLine: View {
    var count = 13
    var thickness: CGFloat = 2.5
    var gap: CGFloat = 9

    var body: some View {
        HStack(spacing: gap) {
            ForEach(0..<count, id: \.self) { _ in
                Rectangle().fill(Color.pink).frame(height: thickness)
            }
        }
    }
}

/// 잔 점선 40개. 항목과 항목 사이.
struct DottedLine: View {
    var count = 40
    var thickness: CGFloat = 2
    var gap: CGFloat = 4
    var color: Color = .pink

    var body: some View {
        HStack(spacing: gap) {
            ForEach(0..<count, id: \.self) { _ in
                Capsule().fill(color).frame(height: thickness)
            }
        }
    }
}

// MARK: - 바코드

/// 60개 막대, 고정 패턴. 디자인 원본과 같은 순서를 쓴다.
struct BarcodeView: View {
    var height: CGFloat = 70
    var color: Color = .pink
    var spacing: CGFloat = 1.5

    static let pattern: [CGFloat] = [
        3, 1, 2, 1, 4, 1, 1, 2, 3, 1, 2, 4, 1, 1, 3, 2, 1, 4, 2, 1,
        1, 3, 1, 2, 4, 1, 3, 1, 1, 2, 3, 1, 4, 1, 2, 1, 1, 3, 2, 4,
        1, 1, 2, 3, 1, 2, 1, 4, 1, 3, 2, 1, 1, 3, 4, 1, 2, 1, 3, 1,
    ]

    var body: some View {
        HStack(spacing: spacing) {
            ForEach(Array(Self.pattern.enumerated()), id: \.offset) { _, w in
                Rectangle().fill(color).frame(width: w, height: height)
            }
        }
    }
}

// MARK: - 종이

/// 종이 면 + 아래 절취면. 배경색은 안쪽 컨테이너에만 칠한다.
struct ReceiptPaper<Content: View>: View {
    var tornTop = false
    @ViewBuilder var content: Content

    var body: some View {
        VStack(spacing: 0) {
            if tornTop {
                TornEdge(pointingUp: true).fill(Color.paper).frame(height: 14)
            }
            content.background(Color.paper)
            TornEdge().fill(Color.paper).frame(height: 15)
        }
        .shadow(color: Color(hex: 0x191817, alpha: 0.2), radius: 3, y: 3)
    }
}

// MARK: - 프린터

/// 종이 뒤에 깔리는 본체.
struct PrinterHousing: View {
    var body: some View {
        ZStack(alignment: .top) {
            RoundedRectangle(cornerRadius: 18)
                .fill(LinearGradient(
                    stops: [
                        .init(color: Color(hex: 0x3A3A3A), location: 0),
                        .init(color: Color(hex: 0x141414), location: 0.55),
                        .init(color: Color(hex: 0x242424), location: 1),
                    ],
                    startPoint: .top, endPoint: .bottom
                ))
                .frame(width: 378, height: 92)

            RoundedRectangle(cornerRadius: 1)
                .fill(Color(hex: 0x5A5A5A))
                .frame(width: 326, height: 2)
                .opacity(0.5)
                .offset(y: 7)
        }
        .frame(width: 378, height: 92, alignment: .top)
    }
}

/// 종이 앞을 덮는 슬롯. 이게 있어야 종이가 프린터 안으로 들어가는 것처럼 보인다.
struct PrinterLip: View {
    var body: some View {
        ZStack(alignment: .top) {
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(hex: 0x0B0B0B))
                .frame(width: 338, height: 24)
                .offset(y: 38)

            RoundedRectangle(cornerRadius: 1)
                .fill(Color(hex: 0x4A4A4A))
                .frame(width: 338, height: 2)
                .opacity(0.7)
                .offset(y: 38)

            RoundedRectangle(cornerRadius: 3)
                .fill(Color(hex: 0x000000, alpha: 0.15))
                .frame(width: 326, height: 6)
                .offset(y: 60)
        }
        .frame(width: 378, height: 92, alignment: .top)
        .allowsHitTesting(false)
    }
}
