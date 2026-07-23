# New. — MVP 구현 문서

영수증 컨셉의 신제품 리뷰 iOS 앱. 바코드를 찍어 제품을 찾고, 없으면 직접 등록하면서 첫 리뷰를 남긴다.

- 디자인 원본: `design/design.pen` (파운데이션 보드 5개 + 화면 7개)
- 누끼 도구: `tools/cutout.swift` (검증 완료 — 앱에도 같은 API를 쓴다)

---

## 1. MVP 범위

**한다**

- 바코드 스캔 → 등록된 제품이면 제품 화면, 없으면 등록 플로우
- 제품 등록: 사진 촬영(배경 자동 제거) → 제품명 → 카테고리 — **사진은 필수**
- 리뷰 작성: 별점 + 본문 + 키워드
- 카테고리별 제품 목록(영수증 스크롤), 제품별 리뷰 목록
- **전부 기기 안에 저장** (SwiftData)

**안 한다**

- 서버, 계정, 다른 사람 리뷰
- 바코드→제품명 자동 조회 (한 번 등록한 바코드는 다음부터 자동으로 채워짐)
- 검색, 알림, 저장/북마크, 도움돼요

**이 선택의 의미**: "이미 등록된 제품"이 **내가 등록한 것만** 뜬다. 플로우와 디자인을 검증하는 데는 충분하지만, 리뷰 앱의 본질인 "남의 리뷰"는 빠져 있다. 서버 전환은 §8 참고.

---

## 2. 스택

| 항목 | 선택 | 이유 |
|---|---|---|
| 최소 버전 | **iOS 17** | `VNGenerateForegroundInstanceMaskRequest`(피사체 분리)와 SwiftData가 둘 다 17부터 |
| UI | SwiftUI | 화면이 7개뿐이고 영수증 뷰를 컴포넌트로 재사용하기 좋음 |
| 저장 | SwiftData | 서버 없이 관계형 모델 + 자동 마이그레이션 |
| 카메라 | AVFoundation | 카메라가 **전체화면이 아니라 영수증 안의 작은 창**이라 프리뷰 레이어를 직접 제어해야 함 |
| 바코드 | `AVCaptureMetadataOutput` | 위와 같은 세션에 붙이면 됨. VisionKit `DataScannerViewController`는 자체 오버레이가 있어 이 디자인과 충돌 |
| 누끼 | Vision | 온디바이스, 무료, 네트워크 불필요 |

---

## 3. 데이터 모델

```swift
enum Category: String, Codable, CaseIterable {
    case ramen = "라면", snack = "과자", drink = "음료"
    case iceCream = "아이스크림", coffee = "커피", etc = "기타"
}

@Model final class Product {
    @Attribute(.unique) var barcode: String
    var name: String
    var categoryRaw: String
    var photoFilename: String?      // 파일명만. 이미지 자체는 Documents/products/
    var createdAt: Date

    @Relationship(deleteRule: .cascade, inverse: \Review.product)
    var reviews: [Review] = []

    var category: Category { Category(rawValue: categoryRaw) ?? .etc }
    var reviewCount: Int { reviews.count }
    var averageRating: Double {
        reviews.isEmpty ? 0 : Double(reviews.map(\.rating).reduce(0, +)) / Double(reviews.count)
    }
}

@Model final class Review {
    var rating: Int                 // 1...5
    var body: String
    var keywords: [String]
    var createdAt: Date
    var product: Product?
}
```

**이미지는 SwiftData에 넣지 않는다.** 누끼 PNG는 2000px 안팎이라 DB에 넣으면 쿼리가 느려진다. `Documents/products/<barcode>.png`로 저장하고 파일명만 들고 있는다.

---

## 4. 화면 ↔ 구현

| 디자인 | 뷰 | 핵심 |
|---|---|---|
| S01 홈 | `HomeView` | 카테고리별 제품 수를 `@Query`로 집계 |
| S02 바코드 스캔 | `BarcodeScanView` | 스캔 성공 → barcode로 `Product` 조회 → 있으면 S03, 없으면 S04 |
| S03 제품 (Review) | `ProductView` | 제품 + 리뷰 목록. `리뷰 쓰기` → S06(리뷰 전용 모드) |
| S04 없는 제품 | `NotFoundView` | CTA → 곧바로 S05 |
| S05 제품 사진 | `ProductPhotoView` | 촬영 → 누끼 → S06으로 이미지 전달 |
| S06 등록 + 리뷰 | `RegisterReviewView` | 사진·제품명·카테고리·별점·리뷰를 한 번에 저장 |
| S07 카테고리 스크롤 | `CategoryFeedView` | 프린터 고정 + 영수증 스크롤 (§5.3) |

### 화면 하나가 비어 있다

S03에서 **이미 등록된 제품에 리뷰만 추가**하는 경로의 디자인이 없다. S06을 두 모드로 쓰는 걸 권장:

- `.register` — 사진·제품명·카테고리 입력 가능 (신규 등록)
- `.reviewOnly` — 제품 정보는 읽기 전용 요약으로 접고 별점부터 시작

`RegisterReviewView(mode:)` 하나로 처리하면 화면을 새로 그릴 필요가 없다.

---

## 5. 핵심 기술 3가지

### 5.1 바코드 스캔 (S02)

카메라 프리뷰가 영수증 안 248×206 창에만 보여야 하므로 `AVCaptureVideoPreviewLayer`를 그 크기로 넣고 마스킹한다.

```swift
let session = AVCaptureSession()
let output = AVCaptureMetadataOutput()
session.addOutput(output)
output.setMetadataObjectsDelegate(self, queue: .main)
output.metadataObjectTypes = [.ean13, .ean8, .upce, .code128]
// 창 밖 바코드를 잡지 않도록 관심영역 제한
output.rectOfInterest = previewLayer.metadataOutputRectConverted(fromLayerRect: windowRect)
```

같은 바코드가 연속으로 잡히므로 **첫 인식 후 세션을 멈추고** 화면 전환한다.

### 5.2 배경 제거 (S05)

`tools/cutout.swift`에서 검증한 것과 같은 API다. 다만 **앱에서는 `--ellipse` 같은 수동 보정을 쓸 수 없으므로** 다른 방법으로 옆 제품을 떼어낸다.

검증에서 확인한 사실: 진열대 사진은 옆 제품이 본체에 맞닿아 **하나의 인스턴스로 잡힌다.** 연결 성분 분리로는 안 떨어진다.

**해결: 피사체 분리 전에 가이드 사각형으로 먼저 크롭한다.**

```swift
func cutout(from image: CGImage, guideRect: CGRect) throws -> CGImage? {
    // 1. 촬영 가이드 영역만 잘라낸다 — 옆 제품이 애초에 안 들어옴
    guard let cropped = image.cropping(to: guideRect) else { return nil }

    // 2. 피사체 분리
    let request = VNGenerateForegroundInstanceMaskRequest()
    let handler = VNImageRequestHandler(cgImage: cropped, options: [:])
    try handler.perform([request])
    guard let obs = request.results?.first as? VNInstanceMaskObservation else { return nil }

    // 3. 알파 PNG로
    let buffer = try obs.generateMaskedImage(
        ofInstances: obs.allInstances, from: handler, croppedToInstancesExtent: true)
    return CIContext().createCGImage(CIImage(cvPixelBuffer: buffer),
                                     from: CIImage(cvPixelBuffer: buffer).extent)
}
```

**폴백은 선택이 아니라 필수다.** 사진 없이는 등록할 수 없으므로, 누끼가 실패해도 반드시 뭔가를 내놓아야 한다. 아래 경우엔 배경 제거를 포기하고 **가이드 영역을 그대로 정사각 크롭**해서 쓴다. 배경이 남지만 영수증 톤은 유지되고, 등록이 막히지 않는다.

- `results`가 비었을 때 (피사체 없음)
- 결과가 크롭 영역의 90% 이상일 때 (배경을 통째로 잡은 것)

S05의 **"배경은 자동으로 지워집니다"** 문구가 곧 이 처리의 예고다. 실패해도 사용자가 배신감을 느끼지 않도록 S06에서 결과를 보여주고 `다시 찍기`를 준다 — 이미 디자인에 있다.

폴백으로 처리된 사진은 플래그를 남겨두면(`Product.photoIsCutout`) 나중에 서버·모델이 좋아졌을 때 재처리 대상을 찾을 수 있다.

> 나중에 쓸 카드: 바코드를 이미 스캔했으므로, 바코드가 화면 어디 있었는지 알면 "여러 제품 중 어느 것"인지 확정할 수 있다. MVP에선 가이드 크롭으로 충분해서 넣지 않는다.

### 5.3 영수증 스크롤 (S07)

디자인 파일은 **다 뽑혀 나온 정지 상태**를 그린 것이고, 스크롤 동작은 코드에서 만든다. 핵심은 **프린터가 스크롤을 따라가지 않는 것**.

```swift
ZStack(alignment: .top) {
    Color.canvas.ignoresSafeArea()

    PrinterHousing()          // 종이 뒤
        .offset(y: 48)

    ScrollView {
        LazyVStack(spacing: 18) { /* 영수증들 */ }
            .padding(.top, 104)     // 첫 장이 슬롯에 물린 상태로 시작
            .frame(width: 300)
    }
    .mask(                     // ← 이게 없으면 환상이 깨진다
        Rectangle().padding(.top, 110)
    )

    PrinterLip()              // 종이 앞 (슬롯 바)
        .offset(y: 48)
}
```

마스크가 빠지면 스크롤할 때 영수증이 **프린터 위쪽 여백에 그대로 나타난다.** 슬롯 라인(y≈110) 아래만 보이게 잘라야 종이가 프린터 안으로 빨려 들어간다.

이렇게 하면 프린터는 **고정된 슬롯**, 영수증은 그 사이를 통과하는 긴 롤로 읽혀서 위아래 어느 방향으로 스크롤해도 자연스럽다.

---

## 6. 디자인 시스템 이식

### 토큰

`design.pen`의 변수를 그대로 옮긴다. 아래는 실제 값(`get_variables` 확인 완료).

```swift
extension Color {
    // 배경
    static let canvas     = Color(hex: 0xE4DED6)   // 홈·제품·없는제품·등록리뷰·카테고리
    static let canvasDark = Color(hex: 0x241F1D)   // 바코드 스캔·제품 사진
    static let paper      = Color(hex: 0xF8F6F3)   // 영수증 종이 + 절취면
    static let paperCard  = Color(hex: 0xFFFDFB)   // 입력창 등 올라온 면
    static let paperShade = Color(hex: 0xEFEAE4)
    static let line       = Color(hex: 0xDED7D0)

    // 텍스트
    static let ink        = Color(hex: 0x191817)
    static let ink2       = Color(hex: 0x55504B)
    static let ink3       = Color(hex: 0x9A938C)

    // 브랜드
    static let pink       = Color(hex: 0xE8427E)
    static let pinkTint   = Color(hex: 0xFBDDE9)   // 빈 별
    static let pinkFaint  = Color(hex: 0xFDF1F6)
    static let pinkGlass  = Color(hex: 0xE8427E, alpha: 0.19)  // 버튼 채움

    // 아이콘 (반투명)
    static let iconPink   = Color(hex: 0xE8427E, alpha: 0.72)
    static let iconInk    = Color(hex: 0x191817, alpha: 0.65)
    static let iconOnPink = Color(hex: 0xFFFFFF, alpha: 0.67)
}
```

반경 `r-sm 8 / r-md 14 / r-full 999`, 간격 `4·8·12·16·20·24·32`.

폰트: 표시·로고 `Archivo`, 본문 `Space Mono`, 라벨·바코드 `Space Mono`.
**주의** — `$font-body`가 Space Mono라 한글에는 글리프가 없다. iOS에서는 시스템 폰트로 대체되는데, 기기마다 결과가 달라진다. 한글 폰트를 명시적으로 지정하거나(`Pretendard` 번들 등) 본문만 다른 서체로 가는 게 안전하다.

### 재사용 뷰

화면 7개가 전부 같은 부품을 쓴다. 먼저 만들고 시작한다.

```swift
struct TornEdge: Shape {          // 절취면. 폭 15 / 깊이 14 / 20개
    var pointingUp = false        // true면 영수증 윗면 (S07 슬립)
    func path(in rect: CGRect) -> Path { ... }
}

struct PerforationLine: View { }  // 핑크 대시 13개, 가로 절취선
struct DottedLine: View { }       // 연한 핑크 점선 40개, 항목 구분
struct ReceiptPaper<Content: View>: View { }  // 종이 + 아래 절취면
struct PrinterHousing: View { }   // 뒤판 (그라디언트 + 상단 하이라이트)
struct PrinterLip: View { }       // 앞판 (슬롯 + 안쪽 그림자)
struct Barcode: View { }          // 60개 막대, 고정 패턴
struct GlassButton: View { }      // 반투명 핑크 + 핑크 글씨, 테두리 없음
```

**절취면은 반드시 종이와 분리해서 그린다.** 종이 프레임에 배경색을 칠하고 그 위에 톱니를 얹으면 골 사이가 종이색으로 메워져 일자로 보인다 — 디자인 작업 중 실제로 겪은 문제다. 종이 배경은 안쪽 컨테이너에만, 절취면은 형제 노드로.

---

## 7. 마일스톤

| # | 목표 | 완료 기준 |
|---|---|---|
| 1 | 디자인 시스템 | `TornEdge`·`ReceiptPaper`·`PrinterHousing/Lip`으로 S01 홈이 디자인과 일치 |
| 2 | 데이터 + 등록 | 바코드 없이 더미 제품·리뷰를 넣고 S03·S07이 실데이터로 뜸 |
| 3 | 바코드 | S02에서 실제 바코드 인식 → 있으면 S03, 없으면 S04 분기 |
| 4 | 사진 + 누끼 | S05 촬영 → 배경 제거 → S06에 미리보기. 폴백 경로까지 |
| 5 | 마감 | 세이프에어리어(§9), 빈 상태, 스크롤 마스크 검증 |

1·2는 카메라 없이 시뮬레이터에서 가능하다. 3·4는 실기기 필요.

---

## 8. 나중에 서버를 붙일 때

로컬 우선이지만 전환을 막지 않도록:

- **`barcode`를 자연키로 쓴다.** UUID를 주키로 두면 나중에 같은 제품이 사람마다 다른 행으로 생겨 병합이 지옥이 된다.
- `createdAt`을 모든 레코드에 남긴다. 동기화 시 충돌 해결 기준.
- 이미지 파일명을 `<barcode>.png`로 통일한다. 그대로 오브젝트 스토리지 키가 된다.

전환 시 추가로 필요한 것: 계정, 제품 중복 정리(같은 제품을 여러 명이 다르게 등록), 신고·차단.

---

## 9. 남은 이슈

- **세이프에어리어** — 프린터가 y=48에서 시작하는데 다이나믹 아일랜드 기기의 안전영역은 59pt다. 상단이 11pt 모자란다. 프린터를 y=60으로 내리거나 화면별로 안전영역 기준을 다시 잡아야 한다.
- **상태바 색** — S02·S05는 배경이 어두워 상태바를 `.lightContent`로 강제해야 한다. 나머지는 밝은 배경이라 기본값.
- **리뷰 전용 진입점** — §4 참고. S06을 두 모드로 쓰는 게 화면을 늘리지 않는 방법.
- **브랜드 표기** — S07 영수증에 브랜드(`하림` 등)가 남아 있는데 S06에서 브랜드 입력을 지웠다. 데이터가 없으므로 표시를 빼거나 입력을 되살려야 한다.
- **사진 촬영 이탈** — 사진이 필수라 S05에서 우회로가 없다. 카메라 권한을 거부했거나 촬영을 취소하면 등록 자체가 막히므로, 권한 거부 시 안내와 설정 이동 경로가 필요하다. 사진첩에서 고르는 경로도 열어둘지 정해야 한다.
