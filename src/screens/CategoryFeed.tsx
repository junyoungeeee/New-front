import { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { averageRating, db, type Product } from '../db/db';
import { StarRating } from '../design/ReceiptScreen';
import { PrintFeed } from '../design/PrintFeed';
import { playChime } from '../lib/feedSound';
import { Barcode, PerforationLine, ReceiptPaper } from '../design/parts';
import { Icon } from '../design/Icon';
import { ProductPhoto } from '../lib/photo';

/** S07 카테고리 — 머리글 한 장 + 제품 슬립들이 프린터에서 한 장씩 뽑혀 나온다.
 *  종이가 아래로 밀려 나오는 동작은 `PrintFeed` 가 맡는다. */
export function CategoryFeed() {
  const { category = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // 기본값을 주지 않는다 — undefined 는 "아직 조회 중". 기본값 []를 주면 조회가 끝나기 전에
  // "아직 등록된 제품이 없어요" 슬립이 먼저 뽑혀 나가고, 뒤늦게 제품 슬립으로 바뀌면서
  // 종이 높이가 늘어나 윗부분(사진)이 슬롯 위로 밀려 올라간다.
  const products = useLiveQuery(async () => {
    const rows = await db.products.where('category').equals(category).toArray();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  }, [category]);
  const loaded = products !== undefined;
  const list: Product[] = products ?? [];

  // 머리글은 영수증이 아니라 프린터 본체에 얹는다 — 왼쪽 항목 이름, 오른쪽 개수.
  const label = (
    <>
      <button className="name" onClick={() => navigate('/')}>
        <Icon name="chevron.left" size={16} color="rgba(255,255,255,0.8)" />
        {category}
      </button>
      <span className="count">{loaded ? `${list.length} ITEMS` : ''}</span>
    </>
  );

  const empty = (
    <ReceiptPaper>
      <div style={{ padding: '44px 26px', textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>아직 등록된 제품이 없어요</div>
        <div style={{ height: 10 }} />
        <div style={{ fontSize: 12.5, color: 'var(--ink3)' }}>
          바코드를 찍어 첫 제품을 등록해보세요.
        </div>
      </div>
    </ReceiptPaper>
  );

  const items = !loaded
    ? []
    : list.length === 0
      ? [empty]
      : list.map((product) => (
          <ProductSlip product={product} onOpen={() => navigate(`/p/${product.barcode}`)} />
        ));

  // 방금 등록하고 넘어온 제품이 있으면 그 장이 나올 때까지 뽑고 징을 울린다.
  const printed = (location.state as { printed?: string } | null)?.printed;
  const printedIndex = printed ? list.findIndex((p) => p.barcode === printed) : -1;

  useEffect(() => {
    if (printedIndex < 0) return;
    playChime();
    // 되돌아왔을 때 다시 울리지 않도록 표시를 지운다
    navigate(location.pathname, { replace: true, state: null });
  }, [printedIndex, location.pathname, navigate]);

  return (
    <PrintFeed items={items} label={label} initial={printedIndex >= 0 ? printedIndex + 1 : 1} />
  );
}

/** 제품 한 장. 사진 · 이름 · 별점 · 바코드. */
function ProductSlip({ product, onOpen }: { product: Product; onOpen: () => void }) {
  const reviews = useLiveQuery(
    () => db.reviews.where('barcode').equals(product.barcode).toArray(),
    [product.barcode],
    [],
  );

  return (
    <button onClick={onOpen} style={{ display: 'block', width: '100%', textAlign: 'left' }}>
      <ReceiptPaper>
        <div style={{ padding: '22px 26px 20px' }}>
          <ProductPhoto barcode={product.barcode} height={148} radius={4} />

          <div style={{ height: 16 }} />
          <div style={{ fontSize: 15, fontWeight: 500 }}>{product.name}</div>

          <div style={{ height: 10 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StarRating rating={averageRating(reviews)} />
            <span className="mono" style={{ fontSize: 12, color: 'var(--pink)' }}>
              ({reviews.length})
            </span>
          </div>

          <div style={{ height: 16 }} />
          <PerforationLine />
          <div style={{ height: 14 }} />

          <Barcode height={34} />
        </div>
      </ReceiptPaper>
    </button>
  );
}
