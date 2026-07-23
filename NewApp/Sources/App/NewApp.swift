import SwiftData
import SwiftUI

@main
struct NewApp: App {
    let container: ModelContainer

    init() {
        do {
            container = try ModelContainer(for: Product.self, Review.self)
        } catch {
            fatalError("SwiftData 컨테이너를 만들지 못했습니다: \(error)")
        }
        SampleData.seedIfNeeded(container.mainContext)
    }

    var body: some Scene {
        WindowGroup {
            RootView()
        }
        .modelContainer(container)
    }
}

enum Route: Hashable {
    case categoryFeed(Category)
    case product(String)   // barcode
}

struct RootView: View {
    @Environment(\.modelContext) private var context
    @State private var path: [Route] = []
    @State private var showScan = false

    var body: some View {
        NavigationStack(path: $path) {
            HomeView(
                onCategory: { path.append(.categoryFeed($0)) },
                onScan: { showScan = true }
            )
            .navigationBarBackButtonHidden()
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: Route.self) { route in
                switch route {
                case .categoryFeed(let category):
                    CategoryFeedView(
                        category: category,
                        onBack: { path.removeLast() },
                        onProduct: { path.append(.product($0.barcode)) }
                    )
                    .toolbar(.hidden, for: .navigationBar)
                case .product(let barcode):
                    ProductView(barcode: barcode, onBack: { path.removeLast() })
                        .toolbar(.hidden, for: .navigationBar)
                }
            }
        }
        .fullScreenCover(isPresented: $showScan) {
            ScanFlow { product in
                showScan = false
                // 커버가 닫히는 애니메이션과 겹치지 않도록 한 박자 뒤에 밀어 넣는다.
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                    path.append(.product(product))
                }
            } onCancel: {
                showScan = false
            }
        }
    }
}
