import { centerCropRect } from './camera';

export interface CutoutResult {
  blob: Blob;
  /** 배경 제거가 실제로 됐는지. false 면 가이드 영역을 그대로 쓴 폴백이다. */
  isCutout: boolean;
}

/** 모델은 수 MB~수십 MB 다. 촬영 후에 받으면 사용자는 셔터를 누르고 수십 초를 기다린다.
 *  S05 에 들어오는 순간(구도를 잡는 동안) 미리 받아 둔다. */
let preloading: Promise<unknown> | null = null;
export function preloadCutoutModel() {
  preloading ??= import('@imgly/background-removal')
    .then((m) => m.preload())
    .catch(() => undefined);
  return preloading;
}

/** 사진은 필수라서 이 함수는 **반드시 뭔가를 내놓는다.** 누끼가 실패해도
 *  가이드 영역을 크롭해서 돌려준다. 배경이 남지만 등록이 막히지는 않는다. */
export async function cutout(source: Blob, windowAspect: number): Promise<CutoutResult> {
  // 1. 촬영 가이드 영역만 잘라낸다 — 옆 제품이 애초에 안 들어오고, 모델 입력도 작아진다.
  //    진열대 사진은 옆 제품이 본체에 맞닿아 하나의 인스턴스로 잡혀서
  //    분리 뒤에 떼어내는 방법으로는 안 떨어진다. 순서를 바꾸지 말 것.
  const cropped = await cropToGuide(source, windowAspect);

  try {
    const { removeBackground } = await import('@imgly/background-removal');
    // 2. 피사체 분리
    const out = await withTimeout(
      removeBackground(cropped, { output: { format: 'image/png' } }),
      90_000,
    );
    // 결과가 크롭 영역의 90% 이상을 덮으면 배경을 통째로 잡은 것 — 폴백
    if ((await opaqueRatio(out)) >= 0.9) return { blob: cropped, isCutout: false };
    return { blob: out, isCutout: true };
  } catch {
    // 3. 폴백 — results 가 비었거나, 모델 다운로드 실패거나, 타임아웃이거나.
    //    웹에서는 실패 경우가 하나 더 있다: 네트워크.
    return { blob: cropped, isCutout: false };
  }
}

async function cropToGuide(source: Blob, windowAspect: number): Promise<Blob> {
  const bitmap = await createImageBitmap(source);
  const { sx, sy, sw, sh } = centerCropRect(bitmap.width, bitmap.height, windowAspect);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw);
  canvas.height = Math.round(sh);
  canvas.getContext('2d')!.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return toBlob(canvas);
}

/** 불투명 픽셀 비율. iOS 는 인스턴스 extent 로 쟀지만 여기서는 결과가 원본과 같은 크기라
 *  알파를 직접 세는 게 같은 의미가 된다. 표본만 보면 충분해서 작게 줄여서 센다. */
async function opaqueRatio(blob: Blob): Promise<number> {
  const bitmap = await createImageBitmap(blob);
  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, size, size);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, size, size);
  let opaque = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 16) opaque++;
  return opaque / (size * size);
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('이미지를 만들지 못했습니다'))),
      'image/png',
    );
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}
