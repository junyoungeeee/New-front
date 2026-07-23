import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader';
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import { centerCropRect } from './camera';

// 기본값은 CDN 에서 wasm 을 받는다. 번들에 든 파일을 쓰도록 경로를 넘긴다 —
// 오프라인에서도 스캔이 되고, 버전이 어긋날 일도 없다.
prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string) =>
      path.endsWith('.wasm') ? wasmUrl : prefix + path,
  },
});

/** `rectOfInterest`(iOS) 에 대응하는 API 는 없다. 대신 프레임을 캔버스에 그릴 때
 *  가이드 창 영역만 잘라서 디코더에 넘긴다 — 같은 효과에 디코딩 비용도 준다. */
export function createScanner(windowAspect: number) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  return async function scan(video: HTMLVideoElement): Promise<string | null> {
    if (!video.videoWidth) return null;
    const { sx, sy, sw, sh } = centerCropRect(video.videoWidth, video.videoHeight, windowAspect);
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    const results = await readBarcodes(ctx.getImageData(0, 0, canvas.width, canvas.height), {
      formats: ['EAN-13', 'EAN-8', 'UPC-E', 'UPC-A', 'Code128'],
      tryHarder: true,
    });
    const hit = results.find((r) => r.isValid && r.text);
    return hit?.text ?? null;
  };
}
