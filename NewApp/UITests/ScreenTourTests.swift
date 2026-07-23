import XCTest

/// 화면을 실제로 눌러가며 한 바퀴 돈다. 각 단계의 스크린샷을 결과 번들에 붙여
/// 디자인과 대조할 수 있게 한다.
final class ScreenTourTests: XCTestCase {
    private var app: XCUIApplication!

    override func setUp() {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }

    private func capture(_ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testTourThroughScreens() {
        // S01 홈
        XCTAssertTrue(app.buttons["category-라면"].waitForExistence(timeout: 10))
        capture("01-home")

        // S07 카테고리 스크롤
        app.buttons["category-라면"].tap()
        XCTAssertTrue(app.staticTexts["2 ITEMS"].waitForExistence(timeout: 5))
        capture("07-category-feed")

        // 스크롤해서 프린터 마스크가 유지되는지 본다
        app.swipeUp()
        capture("07-category-feed-scrolled")

        // S03 제품
        app.buttons["product-8801234567890"].firstMatch.tap()
        XCTAssertTrue(app.buttons["writeReview"].waitForExistence(timeout: 5))
        capture("03-product")

        app.swipeUp()
        capture("03-product-reviews")

        // S06 리뷰 전용 모드
        app.swipeDown()
        app.buttons["writeReview"].tap()
        XCTAssertTrue(app.staticTexts["KEYWORD · 최대 3개"].waitForExistence(timeout: 5))
        capture("06-review-only")
    }

    func testScanFlowFromHome() {
        XCTAssertTrue(app.buttons["scanBlock"].waitForExistence(timeout: 10))
        app.buttons["scanBlock"].tap()

        // 시뮬레이터에는 카메라가 없다 — 권한/실패 폴백이 보여야 한다.
        XCTAssertTrue(app.staticTexts["SCAN MODE"].waitForExistence(timeout: 5))
        capture("02-scan")

        // 바코드 직접 입력으로 등록 흐름에 들어간다.
        app.buttons["바코드 번호 직접 입력"].tap()
        let field = app.textFields.firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 5))
        field.typeText("8809999999999")
        app.buttons["확인"].tap()

        // S04 없는 제품
        XCTAssertTrue(app.staticTexts["NO MATCH FOUND"].waitForExistence(timeout: 5))
        capture("04-not-found")

        // S05 제품 사진
        app.buttons["제품 등록하고 리뷰 쓰기"].tap()
        XCTAssertTrue(app.staticTexts["STEP 1 · 제품 사진"].waitForExistence(timeout: 5))
        capture("05-product-photo")

        // 시뮬레이터에는 카메라가 없으니 사진첩 경로로 누끼·등록 화면까지 확인한다.
        app.buttons["사진첩에서 고르기"].tap()

        // 사진 선택기는 별도 프로세스라 app 쿼리로 잡히지 않는다.
        // 화면 좌표로 누르면 프로세스와 무관하게 그 자리에 이벤트가 간다.
        sleep(6)
        capture("05b-picker")
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.19, dy: 0.45)).tap()

        // S06 등록 모드 — 바코드·사진·제품명·카테고리가 모두 보여야 한다.
        XCTAssertTrue(app.staticTexts["NEW ITEM"].waitForExistence(timeout: 20))
        capture("06-register")

        // 별점 없이는 저장할 수 없다.
        XCTAssertFalse(app.buttons["등록하기"].isEnabled)

        app.textFields.firstMatch.tap()
        app.textFields.firstMatch.typeText("테스트 라면")
        app.images.matching(identifier: "star-4").firstMatch.tap()
        capture("06-register-filled")
    }
}
