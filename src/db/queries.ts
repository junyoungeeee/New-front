import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getProduct,
  listByCategory,
  listProducts,
  reviewStats,
  reviewsOf,
  type Product,
  type Review,
} from './db';

/** 질의 키를 한곳에 모아 둔다. 저장 뒤 무엇을 다시 불러올지가 여기서 한눈에 보인다. */
export const keys = {
  products: ['products'] as const,
  category: (category: string) => ['products', 'category', category] as const,
  product: (barcode: string) => ['product', barcode] as const,
  reviews: (barcode: string) => ['reviews', barcode] as const,
  stats: (barcodes: string[]) => ['reviewStats', [...barcodes].sort().join(',')] as const,
};

export const useProducts = () =>
  useQuery({ queryKey: keys.products, queryFn: listProducts });

export const useCategory = (category: string) =>
  useQuery({ queryKey: keys.category(category), queryFn: () => listByCategory(category) });

/** `undefined` 는 아직 조회 중, `null` 은 없는 제품. 등록 플로우가 이 둘을 구분해야 한다. */
export const useProduct = (barcode: string) =>
  useQuery<Product | null>({ queryKey: keys.product(barcode), queryFn: () => getProduct(barcode) });

export const useReviews = (barcode: string) =>
  useQuery<Review[]>({ queryKey: keys.reviews(barcode), queryFn: () => reviewsOf(barcode) });

/** 목록 화면용. 제품마다 따로 부르면 요청이 제품 수만큼 늘어난다. */
export const useReviewStats = (barcodes: string[]) =>
  useQuery({
    queryKey: keys.stats(barcodes),
    queryFn: () => reviewStats(barcodes),
    enabled: barcodes.length > 0,
  });

/** 리뷰나 제품을 저장한 뒤 화면을 최신으로 되돌린다. */
export function useRefreshAfterWrite() {
  const client = useQueryClient();
  return (barcode: string) => {
    void client.invalidateQueries({ queryKey: ['products'] });
    void client.invalidateQueries({ queryKey: keys.product(barcode) });
    void client.invalidateQueries({ queryKey: keys.reviews(barcode) });
    void client.invalidateQueries({ queryKey: ['reviewStats'] });
  };
}
