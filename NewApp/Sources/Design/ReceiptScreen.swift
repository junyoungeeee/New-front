import SwiftUI

/// 화면 7개가 전부 이 골격을 쓴다.
///
/// 프린터는 고정, 영수증은 그 슬롯을 통과하는 긴 롤. 스크롤은 코드에서 만든다 —
/// 디자인 파일은 다 뽑혀 나온 정지 상태를 그린 것이다.
///
/// **마스크가 핵심이다.** 슬롯 라인 아래만 보이게 잘라야 종이가 프린터 안으로 빨려
/// 들어간다. 빠지면 스크롤할 때 영수증이 프린터 위쪽 여백에 그대로 나타난다.
struct ReceiptScreen<Content: View>: View {
    var dark = false
    var scrolls = true
    @ViewBuilder var content: Content

    /// 원본 좌표(프린터 y=48)를 프린터 상단 기준 오프셋으로 바꾼 값.
    static var slotRecessOffset: CGFloat { 38 }   // 슬롯 홈 윗면
    static var paperTopOffset: CGFloat { 56 }     // 종이가 시작하는 지점
    static var slotLineOffset: CGFloat { 62 }     // 종이가 밖으로 나오는 선

    var body: some View {
        GeometryReader { proxy in
            // 원본은 y=48 이지만 다이나믹 아일랜드 기기의 안전영역은 59pt다.
            // 안전영역에 맞춰 내리면 구형 기기는 48, 아일랜드 기기는 60이 된다.
            let printerTop = max(48, proxy.safeAreaInsets.top + 1)

            ZStack(alignment: .top) {
                (dark ? Color.canvasDark : Color.canvas)

                PrinterHousing().offset(y: printerTop)

                paperRoll(printerTop: printerTop)
                    .mask(
                        Rectangle().padding(.top, printerTop + Self.slotLineOffset)
                    )

                PrinterLip().offset(y: printerTop)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .ignoresSafeArea()
        }
    }

    @ViewBuilder
    private func paperRoll(printerTop: CGFloat) -> some View {
        if scrolls {
            ScrollView(showsIndicators: false) {
                content
                    .frame(width: 300)
                    .padding(.top, printerTop + Self.paperTopOffset)
                    .padding(.bottom, 60)
            }
        } else {
            content
                .frame(width: 300)
                .padding(.top, printerTop + Self.paperTopOffset)
        }
    }
}

// MARK: - 영수증 안에서 반복되는 조각들

/// "New." 로고 + 오른쪽 액션. S01·S02·S04·S05·S06 이 공유한다.
struct ReceiptHeader: View {
    var trailingIcon: String
    var action: () -> Void

    var body: some View {
        HStack {
            Text("New.")
                .font(Typo.display(36))
                .tracking(-1.2)
                .foregroundStyle(Color.pink)
            Spacer()
            Button(action: action) {
                Image(systemName: trailingIcon)
                    .font(.system(size: 21, weight: .medium))
                    .foregroundStyle(Color.iconPink)
                    .frame(width: 26, height: 26)
            }
            .buttonStyle(.plain)
        }
    }
}

/// 반투명 핑크 채움 + 핑크 글씨. 테두리는 유리 느낌만 남긴다.
struct GlassButton: View {
    var icon: String
    var title: String
    var fontSize: CGFloat = 14
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Color.iconPink)
                Text(title)
                    .font(Typo.body(fontSize, weight: .bold))
                    .foregroundStyle(Color.pink)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Color.pinkGlass, in: Capsule())
            .overlay(Capsule().stroke(Color.pinkGlassEdge, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

/// 선택 상태가 있는 알약. 카테고리·키워드가 같은 모양을 쓴다.
struct Chip: View {
    var title: String
    var selected: Bool
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(Typo.body(12.5, weight: selected ? .bold : .medium))
                .foregroundStyle(selected ? Color.paper : Color.ink2)
                .padding(.vertical, 8)
                .padding(.horizontal, 14)
                .background(selected ? Color.ink : Color.paperCard, in: Capsule())
                .overlay(
                    Capsule().stroke(Color.line, lineWidth: selected ? 0 : 1)
                )
        }
        .buttonStyle(.plain)
    }
}

/// 별점. 읽기 전용과 입력용을 한 뷰로 쓴다.
struct StarRating: View {
    var rating: Double
    var size: CGFloat = 15
    var spacing: CGFloat = 3
    var onSelect: ((Int) -> Void)? = nil

    var body: some View {
        HStack(spacing: spacing) {
            ForEach(1...5, id: \.self) { index in
                Image(systemName: "star.fill")
                    .font(.system(size: size))
                    .foregroundStyle(Double(index) <= rating.rounded() ? Color.pink : Color.pinkTint)
                    .frame(width: size, height: size)
                    .contentShape(Rectangle())
                    .onTapGesture { onSelect?(index) }
                    .accessibilityIdentifier("star-\(index)")
            }
        }
        .allowsHitTesting(onSelect != nil)
    }
}

/// 촬영·스캔 창의 네 모서리 괄호.
struct ScanBrackets: View {
    var arm: CGFloat = 28
    var thickness: CGFloat = 2.5

    var body: some View {
        GeometryReader { proxy in
            let w = proxy.size.width, h = proxy.size.height
            ForEach(0..<4, id: \.self) { corner in
                let right = corner % 2 == 1
                let bottom = corner >= 2
                Group {
                    RoundedRectangle(cornerRadius: thickness / 2)
                        .frame(width: arm, height: thickness)
                        .position(x: right ? w - arm / 2 : arm / 2,
                                  y: bottom ? h - thickness / 2 : thickness / 2)
                    RoundedRectangle(cornerRadius: thickness / 2)
                        .frame(width: thickness, height: arm)
                        .position(x: right ? w - thickness / 2 : thickness / 2,
                                  y: bottom ? h - arm / 2 : arm / 2)
                }
                .foregroundStyle(Color.pink)
            }
        }
    }
}
