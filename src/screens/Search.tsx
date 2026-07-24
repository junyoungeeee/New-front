import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type Product } from '../db/db';
import { useProducts, useReviewStats } from '../db/queries';
import { ReceiptHeader, ReceiptScreen, StarRating } from '../design/ReceiptScreen';
import { DottedLine, PerforationLine, ReceiptPaper } from '../design/parts';
import { Icon } from '../design/Icon';
import { ProductPhoto } from '../lib/photo';

/** 제품 검색. 로컬에 든 제품이 많아야 수십 개라 인덱스를 따로 두지 않고 전부 훑는다 —
 *  서버를 붙일 때 이 함수만 질의로 갈아끼우면 된다. */
function match(product: Product, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return (
    product.name.toLowerCase().includes(q) ||
    product.category.toLowerCase().includes(q) ||
    product.barcode.includes(q)
  );
}

export function Search() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const { data: products = [] } = useProducts();

  const results = useMemo(
    () => products.filter((product: Product) => match(product, query)),
    [products, query],
  );
  const { data: stats } = useReviewStats(results.map((p: Product) => p.barcode));

  return (
    <ReceiptScreen>
      <ReceiptPaper>
        <div className="pad" style={{ paddingBottom: 30 }}>
          <ReceiptHeader title="Search" trailingIcon="xmark" onAction={() => navigate(-1)} />

          <div style={{ height: 20 }} />
          <PerforationLine />
          <div style={{ height: 22 }} />

          <div className="search-box">
            <Icon name="magnifyingglass" size={17} color="var(--icon-pink)" />
            <input
              autoFocus
              value={query}
              placeholder="제품 이름이나 바코드"
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="지우기">
                <Icon name="xmark" size={13} color="var(--icon-ink)" />
              </button>
            )}
          </div>

          <div style={{ height: 22 }} />
          <PerforationLine />
          <div style={{ height: 12 }} />

          {query.trim() === '' ? (
            <div className="search-note">이름 · 카테고리 · 바코드로 찾을 수 있어요.</div>
          ) : results.length === 0 ? (
            <div className="search-note">
              ‘{query.trim()}’ 에 맞는 제품이 없어요.
              <br />
              바코드를 찍어 새로 등록해보세요.
            </div>
          ) : (
            results.map((product, index) => (
              <div key={product.barcode}>
                {index > 0 && <DottedLine thickness={1.5} color="var(--pink-tint)" />}
                <button
                  className="search-row"
                  onClick={() => navigate(`/p/${product.barcode}`)}
                >
                  <ProductPhoto path={product.photoPath} width={54} height={54} radius={6} />
                  <span className="body">
                    <span className="field-label">{product.category}</span>
                    <span className="name">{product.name}</span>
                    <span className="rating">
                      <StarRating rating={stats?.get(product.barcode)?.average ?? 0} size={11} />
                      <span className="mono">({stats?.get(product.barcode)?.count ?? 0})</span>
                    </span>
                  </span>
                  <Icon name="chevron.right" size={14} color="var(--icon-pink)" />
                </button>
              </div>
            ))
          )}
        </div>
      </ReceiptPaper>
    </ReceiptScreen>
  );
}
