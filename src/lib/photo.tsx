import { photoUrl } from './supabase';
import { Icon } from '../design/Icon';

/** 제품 사진. 없으면 종이 톤의 빈 자리를 둔다.
 *
 * 서버로 옮기면서 objectURL 을 만들고 해제하던 일이 통째로 사라졌다 — 스토리지 공개 주소를
 * 그대로 `<img src>` 에 물리면 되고, 브라우저 캐시가 알아서 재사용한다. */
export function ProductPhoto({
  path,
  src,
  height,
  width,
  radius = 0,
}: {
  /** 저장된 사진 경로(스토리지 키 또는 정적 경로). */
  path?: string | null;
  /** 아직 저장 전인 미리보기(등록 플로우)에서 쓴다. */
  src?: string;
  height: number;
  width?: number;
  radius?: number;
}) {
  const url = src ?? photoUrl(path);

  return (
    <div
      className={`product-photo${url ? '' : ' empty'}`}
      style={{ height, width: width ?? '100%', borderRadius: radius }}
    >
      {url ? <img src={url} alt="" /> : <Icon name="photo" size={22} />}
    </div>
  );
}
