import { PHOTO_BUCKET, ensureSession, photoUrl, supabase } from '../lib/supabase';

export const CATEGORIES = ['라면', '과자', '음료', '아이스크림', '커피', '기타'] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Product {
  /** 자연키. UUID 를 주키로 두면 같은 제품이 사람마다 다른 행으로 생겨 병합이 지옥이 된다. */
  barcode: string;
  name: string;
  category: Category;
  /** 스토리지 객체 키 또는 정적 경로. 화면에서는 `photoUrl()` 로 주소를 만든다. */
  photoPath: string | null;
  /** 배경 제거가 실제로 성공했는지. 폴백으로 처리된 사진을 나중에 다시 찾기 위한 표시. */
  photoIsCutout: boolean;
  createdAt: number;
}

export interface Review {
  id: string;
  barcode: string;
  rating: number; // 1...5
  body: string;
  keywords: string[];
  createdAt: number;
}

// ─── 행 ↔ 모델 ───
// DB 는 snake_case + ISO 시각, 화면은 camelCase + epoch ms 를 쓴다. 변환을 여기서만 한다.

interface ProductRow {
  barcode: string;
  name: string;
  category: string;
  photo_path: string | null;
  photo_is_cutout: boolean;
  created_at: string;
}

interface ReviewRow {
  id: string;
  barcode: string;
  rating: number;
  body: string;
  keywords: string[];
  created_at: string;
}

const toProduct = (row: ProductRow): Product => ({
  barcode: row.barcode,
  name: row.name,
  category: row.category as Category,
  photoPath: row.photo_path,
  photoIsCutout: row.photo_is_cutout,
  createdAt: Date.parse(row.created_at),
});

const toReview = (row: ReviewRow): Review => ({
  id: row.id,
  barcode: row.barcode,
  rating: row.rating,
  body: row.body,
  keywords: row.keywords ?? [],
  createdAt: Date.parse(row.created_at),
});

/** Supabase 오류는 조용히 넘기면 화면이 빈 채로 멈춘다. 던져서 React Query 가 잡게 한다. */
function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

// ─── 조회 ───

export async function listProducts(): Promise<Product[]> {
  const rows = unwrap(await supabase.from('products').select('*'));
  return (rows as ProductRow[]).map(toProduct);
}

export async function listByCategory(category: string): Promise<Product[]> {
  const rows = unwrap(
    await supabase
      .from('products')
      .select('*')
      .eq('category', category)
      .order('created_at', { ascending: false }),
  );
  return (rows as ProductRow[]).map(toProduct);
}

/** 없으면 `null`. "아직 조회 중"(undefined)과 구분되어야 등록 플로우가 갈린다. */
export async function getProduct(barcode: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('barcode', barcode)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toProduct(data as ProductRow) : null;
}

export async function reviewsOf(barcode: string): Promise<Review[]> {
  const rows = unwrap(
    await supabase
      .from('reviews')
      .select('*')
      .eq('barcode', barcode)
      .order('created_at', { ascending: false }),
  );
  return (rows as ReviewRow[]).map(toReview);
}

/** 목록 화면에서 제품마다 따로 부르면 요청이 제품 수만큼 늘어난다. 한 번에 받아 묶는다. */
export async function reviewStats(barcodes: string[]): Promise<Map<string, { count: number; average: number }>> {
  const stats = new Map<string, { count: number; average: number }>();
  if (barcodes.length === 0) return stats;

  const rows = unwrap(
    await supabase.from('reviews').select('barcode, rating').in('barcode', barcodes),
  ) as { barcode: string; rating: number }[];

  for (const row of rows) {
    const current = stats.get(row.barcode) ?? { count: 0, average: 0 };
    current.average = (current.average * current.count + row.rating) / (current.count + 1);
    current.count += 1;
    stats.set(row.barcode, current);
  }
  return stats;
}

export function averageRating(reviews: Review[]) {
  if (!reviews.length) return 0;
  return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
}

// ─── 저장 ───

/** 사진을 스토리지에 올리고 객체 키를 돌려준다.
 *  키를 바코드로 통일해 두면 제품 행과 사진이 따로 놀 일이 없다. */
export async function uploadPhoto(barcode: string, blob: Blob): Promise<string> {
  const extension = blob.type === 'image/webp' ? 'webp' : 'png';
  const path = `${barcode}.${extension}`;
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: true });
  if (error) throw new Error(error.message);
  return path;
}

export async function createProduct(input: {
  barcode: string;
  name: string;
  category: Category;
  photoPath: string | null;
  photoIsCutout: boolean;
}) {
  await ensureSession();
  // 같은 제품을 여러 명이 동시에 등록할 수 있다. 먼저 올라간 것을 살린다.
  const { error } = await supabase.from('products').insert({
    barcode: input.barcode,
    name: input.name,
    category: input.category,
    photo_path: input.photoPath,
    photo_is_cutout: input.photoIsCutout,
  });
  if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
}

export async function addReview(
  barcode: string,
  input: Pick<Review, 'rating' | 'body' | 'keywords'>,
) {
  await ensureSession();
  const { error } = await supabase.from('reviews').insert({ barcode, ...input });
  if (error) throw new Error(error.message);
}

export { photoUrl };

/** "5일 전" 처럼 리뷰 목록에 붙는 짧은 표기. */
export function shortRelative(timestamp: number) {
  const seconds = (Date.now() - timestamp) / 1000;
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days >= 30) return `${Math.floor(days / 30)}달 전`;
  if (days >= 1) return `${days}일 전`;
  if (hours >= 1) return `${hours}시간 전`;
  if (minutes >= 1) return `${minutes}분 전`;
  return '방금';
}
