import { centerCropRect } from './camera';

export interface CutoutResult {
  blob: Blob;
  /** 배경 제거가 실제로 됐는지. false 면 가이드 영역을 그대로 쓴 폴백이다. */
  isCutout: boolean;
}

/** 저장·업로드할 사진의 긴 변 최대 길이.
 *
 * 누끼 원본은 2000px 안팎이라 PNG 로 9MB 를 넘긴다. 로컬에만 둘 때는 넘어갔지만 서버로
 * 올리면 셀룰러 업로드가 한참 걸리고, 목록 화면에서 여러 장을 받으면 데이터가 터진다.
 * 영수증 안에서 가장 크게 쓰이는 자리가 248×175 이므로 1024 면 넉넉하다. */
const MAX_EDGE = 1024;

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
    if ((await opaqueRatio(out)) >= 0.9) return { blob: await shrink(cropped), isCutout: false };
    return { blob: await shrink(out), isCutout: true };
  } catch {
    // 3. 폴백 — results 가 비었거나, 모델 다운로드 실패거나, 타임아웃이거나.
    //    웹에서는 실패 경우가 하나 더 있다: 네트워크.
    return { blob: await shrink(cropped), isCutout: false };
  }
}

/** 긴 변을 MAX_EDGE 로 줄이고 WebP 로 다시 굽는다.
 *
 * WebP 는 알파를 지원해서 누끼 투명도가 살아남고, 같은 그림을 PNG 의 1/10 안팎으로 담는다.
 * 다만 사파리는 오랫동안 캔버스 WebP **인코딩**을 지원하지 않으면서도 조용히 PNG 를
 * 돌려줬다. 그래서 결과 타입을 확인하고, WebP 가 아니면 PNG 로 받아들인다 —
 * 크기는 덜 줄지만 리사이즈만으로도 9MB 대에서 한참 내려온다. */
async function shrink(source: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(source);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const webp = await toBlob(canvas, 'image/webp', 0.85);
  if (webp.type === 'image/webp') return webp;
  return toBlob(canvas, 'image/png');
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

function toBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('이미지를 만들지 못했습니다'))),
      type,
      quality,
    );
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}
