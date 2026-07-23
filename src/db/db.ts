import Dexie, { type Table } from 'dexie';

export const CATEGORIES = ['라면', '과자', '음료', '아이스크림', '커피', '기타'] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Product {
  /** 자연키. UUID 를 주키로 두면 나중에 서버를 붙일 때 같은 제품이 사람마다
   *  다른 행으로 생겨 병합이 지옥이 된다. */
  barcode: string;
  name: string;
  category: Category;
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

/** 누끼 PNG 는 2000px 안팎이라 products 와 같은 스토어에 두면 목록 조회마다
 *  수 MB 를 역직렬화하게 된다. 스토어를 분리해 목록 쿼리가 blob 을 건드리지 않게 한다.
 *  키를 바코드로 통일해 두면 나중에 그대로 오브젝트 스토리지 키가 된다. */
export interface Photo {
  barcode: string;
  blob: Blob;
}

class NewDB extends Dexie {
  products!: Table<Product, string>;
  reviews!: Table<Review, string>;
  photos!: Table<Photo, string>;

  constructor() {
    super('new-app');
    this.version(1).stores({
      products: 'barcode, category, createdAt',
      reviews: 'id, barcode, createdAt',
      photos: 'barcode',
    });
    // 클래스 필드 선언(useDefineForClassFields)이 super() 직후 실행되면서 Dexie 가 만들어 둔
    // 테이블 프로퍼티를 undefined 로 덮어쓴다. 생성자 본문에서 다시 물려야 한다.
    this.products = this.table('products');
    this.reviews = this.table('reviews');
    this.photos = this.table('photos');
  }
}

export const db = new NewDB();

// ─── 조회 ───

export async function getProduct(barcode: string) {
  return db.products.get(barcode);
}

export async function reviewsOf(barcode: string) {
  const rows = await db.reviews.where('barcode').equals(barcode).toArray();
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export function averageRating(reviews: Review[]) {
  if (!reviews.length) return 0;
  return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
}

export async function savePhoto(barcode: string, blob: Blob) {
  await db.photos.put({ barcode, blob });
}

export async function addReview(
  barcode: string,
  input: Pick<Review, 'rating' | 'body' | 'keywords'>,
) {
  await db.reviews.add({
    id: crypto.randomUUID(),
    barcode,
    createdAt: Date.now(),
    ...input,
  });
}

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

// ─── 시드 ───
// 마일스톤 1·2 는 카메라 없이 확인한다. 바코드 없이도 S03·S07 이 실데이터로 뜨도록
// 첫 실행에 더미를 넣는다. (SampleData.swift 와 같은 내용)

const DAY = 86_400_000;

const SEEDS: {
  barcode: string;
  name: string;
  category: Category;
  asset?: string;
  reviews: [number, string, string[], number][];
}[] = [
  {
    barcode: '8801234567890',
    name: '대파 육개장면',
    category: '라면',
    asset: '/seed/daepa-ramen.png',
    reviews: [
      [5, '대파 향이 진짜 진해요.\n국물이 칼칼하고 시원합니다!', ['국물이 진해요', '해장용'], 5],
      [4, '육개장 국물에 대파가 듬뿍이라\n해장으로 딱이에요.', ['해장용'], 12],
      [5, '면발이 쫄깃하고 대파블럭이 실해요.\n재구매 의사 100%입니다!', ['재구매'], 21],
      [3, '생각보다 안 맵고 순한 편이에요.\n계란 풀어 먹으면 더 맛있어요.', [], 30],
    ],
  },
  {
    barcode: '8801234567891',
    name: '제주 똣똣라면',
    category: '라면',
    asset: '/seed/jeju-ramen.png',
    reviews: [
      [4, '국물이 담백하고 깔끔해요.\n짜지 않아서 좋았습니다.', ['가성비'], 3],
      [5, '제주 느낌 물씬 나는 맛이에요.\n선물용으로도 괜찮아요.', ['재구매'], 9],
    ],
  },
  {
    barcode: '8801234567892',
    name: '초코 쿠키샌드',
    category: '과자',
    reviews: [[4, '달지 않고 초코가 진해요.', ['달아요'], 2]],
  },
];

export async function seedIfNeeded() {
  if ((await db.products.count()) > 0) return;

  for (const seed of SEEDS) {
    let hasPhoto = false;
    if (seed.asset) {
      try {
        const res = await fetch(seed.asset);
        if (res.ok) {
          await savePhoto(seed.barcode, await res.blob());
          hasPhoto = true;
        }
      } catch {
        // 시드 이미지가 없어도 앱은 떠야 한다
      }
    }

    await db.products.put({
      barcode: seed.barcode,
      name: seed.name,
      category: seed.category,
      photoIsCutout: hasPhoto,
      createdAt: Date.now() - SEEDS.length * DAY,
    });

    for (const [rating, body, keywords, daysAgo] of seed.reviews) {
      await db.reviews.add({
        id: crypto.randomUUID(),
        barcode: seed.barcode,
        rating,
        body,
        keywords,
        createdAt: Date.now() - daysAgo * DAY,
      });
    }
  }
}
