// 제품 사진에서 배경을 제거해 알파 PNG로 저장한다.
// Apple Vision의 피사체 분리(VNGenerateForegroundInstanceMaskRequest)를 사용 — 온디바이스, 네트워크 불필요.
//
//   swift tools/cutout.swift <input> <output.png> [--largest] [--crop x,y,w,h] [--pad 40]
//
// --erase    분리 결과에서 지울 영역(좌상단 원점, 픽셀). 여러 번 줄 수 있다. 진열대에서
//            옆 제품이 본체에 맞닿아 한 덩어리로 잡혔을 때 그 부분을 먼저 잘라낸다.
// --largest  남은 것 중 가장 큰 덩어리 하나만 취하고 그 bounding box로 자른다.
//            --erase로 연결이 끊긴 잔여물을 정리하는 마무리 단계.
// --crop     최종 결과에서 남길 영역(픽셀). 수동 보정용.
// --pad      사방에 추가할 투명 여백. 영수증 위에서 가장자리가 붙어 보이지 않게 한다.
//
// 순서: erase -> largest -> crop -> pad

import Foundation
import Vision
import CoreImage
import AppKit

func fail(_ msg: String) -> Never {
    FileHandle.standardError.write("cutout: \(msg)\n".data(using: .utf8)!)
    exit(1)
}

/// CIImage를 RGBA8 바이트 배열로 펼친다. 좌상단 원점 기준으로 픽셀을 다루기 위한 공통 단계.
func rasterize(_ image: CIImage, context: CIContext) -> (pixels: [UInt8], w: Int, h: Int, colorSpace: CGColorSpace)? {
    let w = Int(image.extent.width), h = Int(image.extent.height)
    guard w > 0, h > 0, let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) else { return nil }
    var pixels = [UInt8](repeating: 0, count: w * h * 4)
    pixels.withUnsafeMutableBytes { buf in
        context.render(image, toBitmap: buf.baseAddress!, rowBytes: w * 4,
                       bounds: image.extent, format: .RGBA8, colorSpace: colorSpace)
    }
    return (pixels, w, h, colorSpace)
}

func makeImage(_ pixels: [UInt8], w: Int, h: Int, colorSpace: CGColorSpace) -> CIImage {
    CIImage(bitmapData: Data(pixels), bytesPerRow: w * 4,
            size: CGSize(width: w, height: h), format: .RGBA8, colorSpace: colorSpace)
}

/// 타원 바깥의 알파를 0으로 만든다. 컵라면·캔처럼 둥근 제품에서 모서리에 걸린
/// 옆 제품을 한 번에 털어내는 용도. 좌표는 좌상단 원점.
func keepEllipse(_ image: CIImage, cx: Double, cy: Double, rx: Double, ry: Double, context: CIContext) -> CIImage? {
    guard let raster = rasterize(image, context: context) else { return nil }
    var pixels = raster.pixels
    let (w, h, colorSpace) = (raster.w, raster.h, raster.colorSpace)
    for y in 0..<h {
        let dy = (Double(y) - cy) / ry
        for x in 0..<w {
            let dx = (Double(x) - cx) / rx
            if dx * dx + dy * dy > 1.0 {
                let p = (y * w + x) * 4
                pixels[p] = 0; pixels[p + 1] = 0; pixels[p + 2] = 0; pixels[p + 3] = 0
            }
        }
    }
    return makeImage(pixels, w: w, h: h, colorSpace: colorSpace)
}

/// 지정한 사각형들(좌상단 원점)의 알파를 0으로 만든다.
func eraseRegions(_ image: CIImage, rects: [CGRect], context: CIContext) -> CIImage? {
    guard let raster = rasterize(image, context: context) else { return nil }
    var pixels = raster.pixels
    let (w, h, colorSpace) = (raster.w, raster.h, raster.colorSpace)
    for rect in rects {
        let x0 = max(0, Int(rect.minX)), x1 = min(w, Int(rect.maxX))
        let y0 = max(0, Int(rect.minY)), y1 = min(h, Int(rect.maxY))
        guard x0 < x1, y0 < y1 else { continue }
        for y in y0..<y1 {
            for x in x0..<x1 {
                let p = (y * w + x) * 4
                pixels[p] = 0; pixels[p + 1] = 0; pixels[p + 2] = 0; pixels[p + 3] = 0
            }
        }
    }
    return makeImage(pixels, w: w, h: h, colorSpace: colorSpace)
}

/// 알파가 살아있는 픽셀들을 4방향으로 이어붙여 가장 큰 덩어리만 남기고 나머지는 투명하게 지운다.
/// 결과는 남은 덩어리의 bounding box로 잘라서 돌려준다.
func keepLargestComponent(_ image: CIImage, context: CIContext) -> CIImage? {
    guard let raster = rasterize(image, context: context) else { return nil }
    var pixels = raster.pixels
    let (w, h, colorSpace) = (raster.w, raster.h, raster.colorSpace)

    let alphaFloor: UInt8 = 16
    var labels = [Int32](repeating: 0, count: w * h)   // 0 = 미방문
    var nextLabel: Int32 = 0
    var bestLabel: Int32 = 0
    var bestCount = 0
    var stack = [Int]()
    stack.reserveCapacity(1024)

    for start in 0..<(w * h) where labels[start] == 0 && pixels[start * 4 + 3] > alphaFloor {
        nextLabel += 1
        var count = 0
        stack.removeAll(keepingCapacity: true)
        stack.append(start)
        labels[start] = nextLabel

        while let p = stack.popLast() {
            count += 1
            let x = p % w, y = p / w
            // 4-이웃
            if x > 0     { let n = p - 1; if labels[n] == 0 && pixels[n * 4 + 3] > alphaFloor { labels[n] = nextLabel; stack.append(n) } }
            if x < w - 1 { let n = p + 1; if labels[n] == 0 && pixels[n * 4 + 3] > alphaFloor { labels[n] = nextLabel; stack.append(n) } }
            if y > 0     { let n = p - w; if labels[n] == 0 && pixels[n * 4 + 3] > alphaFloor { labels[n] = nextLabel; stack.append(n) } }
            if y < h - 1 { let n = p + w; if labels[n] == 0 && pixels[n * 4 + 3] > alphaFloor { labels[n] = nextLabel; stack.append(n) } }
        }
        if count > bestCount { bestCount = count; bestLabel = nextLabel }
    }
    guard bestLabel != 0 else { return nil }

    var minX = w, minY = h, maxX = -1, maxY = -1
    for p in 0..<(w * h) {
        if labels[p] == bestLabel {
            let x = p % w, y = p / w
            if x < minX { minX = x }; if x > maxX { maxX = x }
            if y < minY { minY = y }; if y > maxY { maxY = y }
        } else {
            pixels[p * 4 + 0] = 0; pixels[p * 4 + 1] = 0
            pixels[p * 4 + 2] = 0; pixels[p * 4 + 3] = 0
        }
    }
    print("components: \(nextLabel), largest keeps \(bestCount) px (\(bestCount * 100 / (w * h))% of subject box)")

    let cleaned = makeImage(pixels, w: w, h: h, colorSpace: colorSpace)
    // CIImage는 좌하단 원점이라, 위에서 센 y를 뒤집어 자른다.
    let box = CGRect(x: minX, y: h - 1 - maxY, width: maxX - minX + 1, height: maxY - minY + 1)
    return cleaned.cropped(to: box)
}

let args = CommandLine.arguments
guard args.count >= 3 else { fail("usage: cutout <input> <output.png> [--crop x,y,w,h] [--pad N]") }
let inPath = args[1]
let outPath = args[2]

var cropRect: CGRect? = nil
var eraseRects: [CGRect] = []
var ellipse: (cx: Double, cy: Double, rx: Double, ry: Double)? = nil
var pad: CGFloat = 0
var keepLargest = false
var i = 3
while i < args.count {
    switch args[i] {
    case "--largest":
        keepLargest = true
        i += 1
    case "--ellipse":
        guard i + 1 < args.count else { fail("--ellipse needs cx,cy,rx,ry") }
        let n = args[i + 1].split(separator: ",").compactMap { Double($0) }
        guard n.count == 4 else { fail("--ellipse needs exactly cx,cy,rx,ry") }
        ellipse = (n[0], n[1], n[2], n[3])
        i += 2
    case "--erase":
        guard i + 1 < args.count else { fail("--erase needs x,y,w,h") }
        let n = args[i + 1].split(separator: ",").compactMap { Double($0) }
        guard n.count == 4 else { fail("--erase needs exactly x,y,w,h") }
        eraseRects.append(CGRect(x: n[0], y: n[1], width: n[2], height: n[3]))
        i += 2
    case "--crop":
        guard i + 1 < args.count else { fail("--crop needs x,y,w,h") }
        let n = args[i + 1].split(separator: ",").compactMap { Double($0) }
        guard n.count == 4 else { fail("--crop needs exactly x,y,w,h") }
        cropRect = CGRect(x: n[0], y: n[1], width: n[2], height: n[3])
        i += 2
    case "--pad":
        guard i + 1 < args.count, let p = Double(args[i + 1]) else { fail("--pad needs a number") }
        pad = CGFloat(p)
        i += 2
    default:
        fail("unknown option \(args[i])")
    }
}

// NSImage 경유로 로드하면 EXIF 회전이 이미 적용된 상태로 들어온다.
guard let image = NSImage(contentsOfFile: inPath),
      let tiff = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiff),
      let cgImage = bitmap.cgImage else { fail("could not read \(inPath)") }

let request = VNGenerateForegroundInstanceMaskRequest()
let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
do { try handler.perform([request]) } catch { fail("vision failed: \(error)") }

guard let observation = request.results?.first as? VNInstanceMaskObservation else {
    fail("no subject found in \(inPath)")
}
guard let masked = try? observation.generateMaskedImage(
    ofInstances: observation.allInstances,
    from: handler,
    croppedToInstancesExtent: true
) else { fail("could not build masked image") }

let context = CIContext()
var ci = CIImage(cvPixelBuffer: masked)
print("subject: \(Int(ci.extent.width))x\(Int(ci.extent.height)) from \(cgImage.width)x\(cgImage.height)")

if let e = ellipse {
    guard let masked = keepEllipse(ci, cx: e.cx, cy: e.cy, rx: e.rx, ry: e.ry, context: context) else { fail("ellipse mask failed") }
    ci = masked
    print("ellipse mask applied")
}

if !eraseRects.isEmpty {
    guard let erased = eraseRegions(ci, rects: eraseRects, context: context) else { fail("erase failed") }
    ci = erased
    print("erased \(eraseRects.count) region(s)")
}

if keepLargest {
    guard let biggest = keepLargestComponent(ci, context: context) else { fail("could not isolate a component") }
    ci = biggest.transformed(by: CGAffineTransform(translationX: -biggest.extent.origin.x, y: -biggest.extent.origin.y))
    print("largest: \(Int(ci.extent.width))x\(Int(ci.extent.height))")
}

if let crop = cropRect {
    // CoreImage는 좌하단 원점이므로, 위에서부터 세는 y를 뒤집어 준다.
    let flipped = CGRect(x: ci.extent.minX + crop.minX,
                         y: ci.extent.maxY - crop.minY - crop.height,
                         width: crop.width,
                         height: crop.height)
    ci = ci.cropped(to: flipped)
    guard !ci.extent.isEmpty else { fail("--crop is outside the subject extent") }
    print("cropped: \(Int(ci.extent.width))x\(Int(ci.extent.height))")
}

// 원점을 0,0으로 되돌린 뒤 투명 여백을 붙인다.
ci = ci.transformed(by: CGAffineTransform(translationX: -ci.extent.origin.x, y: -ci.extent.origin.y))
if pad > 0 {
    // cropped()는 이미지 밖으로 넓히지 못하므로, 투명 배경 위에 얹어서 여백을 만든다.
    let canvas = CGRect(x: 0, y: 0, width: ci.extent.width + pad * 2, height: ci.extent.height + pad * 2)
    ci = ci.transformed(by: CGAffineTransform(translationX: pad, y: pad))
           .composited(over: CIImage(color: .clear).cropped(to: canvas))
}

guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) else { fail("no sRGB color space") }
do {
    try context.writePNGRepresentation(of: ci, to: URL(fileURLWithPath: outPath), format: .RGBA8, colorSpace: colorSpace)
} catch { fail("could not write \(outPath): \(error)") }

print("wrote \(outPath)  \(Int(ci.extent.width))x\(Int(ci.extent.height))")
