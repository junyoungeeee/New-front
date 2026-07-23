import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 없습니다. .env.example 을 참고해 .env.local 을 만들어주세요.',
  );
}

/** anon 키는 비밀이 아니다 — 번들에 박혀 모든 방문자에게 내려간다.
 *  데이터를 지키는 건 이 키가 아니라 RLS 정책이다(supabase/schema.sql). */
export const supabase = createClient(url, anonKey);

/** 리뷰에 작성자를 붙이기 위한 익명 로그인.
 *
 * 대시보드에서 익명 로그인이 꺼져 있으면 조용히 넘어간다 — 그 경우 `author_id` 가 비고
 * 본인 글 수정·삭제만 못 하게 될 뿐, 등록과 리뷰 쓰기는 그대로 된다. */
export async function ensureSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  const { data: created } = await supabase.auth.signInAnonymously();
  return created.session ?? null;
}

export const PHOTO_BUCKET = 'product-photos';

/** 저장된 사진 경로를 실제로 불러올 수 있는 주소로 바꾼다.
 *  시드 제품은 앱에 들어 있는 정적 파일(`/seed/...`)을 가리키므로 그대로 돌려준다. */
export function photoUrl(path?: string | null) {
  if (!path) return undefined;
  if (path.startsWith('/') || path.startsWith('http')) return path;
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}
