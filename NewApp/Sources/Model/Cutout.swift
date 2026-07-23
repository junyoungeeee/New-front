import CoreImage
import UIKit
import Vision

/// 배경 제거. `tools/cutout.swift` 에서 검증한 것과 같은 API 다.
///
/// 다만 앱에서는 `--ellipse` 같은 수동 보정을 쓸 수 없다. 검증에서 확인한 사실 —
/// 진열대 사진은 옆 제품이 본체에 맞닿아 하나의 인스턴스로 잡히고, 연결 성분 분리로는
/// 안 떨어진다. 그래서 **피사체 분리 전에 가이드 사각형으로 먼저 크롭한다.**
enum Cutout {
    struct Result {
        var image: UIImage
        /// 배경 제거가 실제로 됐는지. false 면 가이드 영역을 그대로 쓴 폴백이다.
        var isCutout: Bool
    }

    private static let context = CIContext()

    /// 사진은 필수라서 이 함수는 **반드시 뭔가를 내놓는다.** 누끼가 실패해도
    /// 가이드 영역을 정사각 크롭해서 돌려준다. 배경이 남지만 등록이 막히지는 않는다.
    static func perform(on image: UIImage, guideRect: CGRect) -> Result {
        guard let cgImage = image.cgImage else {
            return Result(image: image, isCutout: false)
        }

        // 1. 촬영 가이드 영역만 잘라낸다 — 옆 제품이 애초에 안 들어옴
        let cropRect = guideRect.integral.intersection(
            CGRect(x: 0, y: 0, width: cgImage.width, height: cgImage.height)
        )
        guard !cropRect.isNull, !cropRect.isEmpty,
              let cropped = cgImage.cropping(to: cropRect) else {
            return Result(image: image, isCutout: false)
        }

        let fallback = UIImage(cgImage: cropped, scale: image.scale, orientation: image.imageOrientation)

        // 2. 피사체 분리
        let request = VNGenerateForegroundInstanceMaskRequest()
        let handler = VNImageRequestHandler(cgImage: cropped, options: [:])
        do {
            try handler.perform([request])
        } catch {
            return Result(image: fallback, isCutout: false)
        }

        // results 가 비었으면 피사체가 없는 것 — 폴백
        guard let observation = request.results?.first as? VNInstanceMaskObservation,
              !observation.allInstances.isEmpty else {
            return Result(image: fallback, isCutout: false)
        }

        // 3. 알파 PNG 로
        guard let buffer = try? observation.generateMaskedImage(
            ofInstances: observation.allInstances,
            from: handler,
            croppedToInstancesExtent: true
        ) else {
            return Result(image: fallback, isCutout: false)
        }

        let ciImage = CIImage(cvPixelBuffer: buffer)
        guard let output = context.createCGImage(ciImage, from: ciImage.extent) else {
            return Result(image: fallback, isCutout: false)
        }

        // 결과가 크롭 영역의 90% 이상이면 배경을 통째로 잡은 것 — 폴백
        let croppedArea = CGFloat(cropped.width * cropped.height)
        let subjectArea = CGFloat(output.width * output.height)
        guard croppedArea > 0, subjectArea / croppedArea < 0.9 else {
            return Result(image: fallback, isCutout: false)
        }

        return Result(
            image: UIImage(cgImage: output, scale: image.scale, orientation: .up),
            isCutout: true
        )
    }
}
