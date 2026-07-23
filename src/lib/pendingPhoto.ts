/** S05 → S06 으로 넘기는 촬영 결과.
 *
 * 웹에서는 브라우저 뒤로가기로 플로우 중간에 되돌아올 수 있다. 결과를 히스토리 state 에
 * 넣으면 뒤로/앞으로 오갈 때 되살아나 유령 등록이 생긴다. **메모리로만 넘기고**,
 * S06 에 결과 없이 들어오면 S05 로 돌려보낸다. */
export interface PendingPhoto {
  barcode: string;
  blob: Blob;
  isCutout: boolean;
  /** 미리보기용. 소비하거나 버릴 때 반드시 해제한다. */
  url: string;
}

let pending: PendingPhoto | null = null;

export function setPendingPhoto(next: Omit<PendingPhoto, 'url'>) {
  clearPendingPhoto();
  pending = { ...next, url: URL.createObjectURL(next.blob) };
}

export function peekPendingPhoto(barcode: string) {
  return pending?.barcode === barcode ? pending : null;
}

export function clearPendingPhoto() {
  if (pending) URL.revokeObjectURL(pending.url);
  pending = null;
}
