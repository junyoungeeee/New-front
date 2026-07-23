import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Icon } from '../design/Icon';

/** 저장된 blob 을 objectURL 로 물린다.
 *
 * **한 번만 읽으면 안 된다.** 제품 행과 사진은 각각 다른 트랜잭션으로 저장되는데, 제품이
 * 먼저 커밋되면 그 사이에 슬립이 그려지면서 사진 조회가 빈손으로 끝난다. 단발 `useEffect`
 * 로는 뒤늦게 들어온 사진을 영영 못 보고 빈 자리로 남는다 — S07 에서 실제로 겪었다.
 * `useLiveQuery` 로 두면 사진이 들어오는 순간 알아서 다시 그린다.
 *
 * objectURL **해제는 반드시 한다** — 영수증이 수십 장 지나가는 동안 놓아주지 않으면
 * 메모리가 그대로 쌓인다. */
export function usePhotoUrl(barcode?: string) {
  const photo = useLiveQuery(
    () => (barcode ? db.photos.get(barcode) : undefined),
    [barcode],
  );
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    const blob = photo?.blob;
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
      setUrl(undefined);
    };
  }, [photo?.blob]);

  return url;
}

/** 저장된 누끼 PNG. 없으면 종이 톤의 빈 자리를 둔다. */
export function ProductPhoto({
  barcode,
  height,
  width,
  radius = 0,
  src,
}: {
  barcode?: string;
  height: number;
  width?: number;
  radius?: number;
  /** 아직 저장 전인 미리보기(등록 플로우)에서 쓴다. */
  src?: string;
}) {
  const stored = usePhotoUrl(src ? undefined : barcode);
  const url = src ?? stored;

  return (
    <div
      className={`product-photo${url ? '' : ' empty'}`}
      style={{ height, width: width ?? '100%', borderRadius: radius }}
    >
      {url ? <img src={url} alt="" /> : <Icon name="photo" size={22} />}
    </div>
  );
}
