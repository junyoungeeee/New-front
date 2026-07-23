import { useNavigate } from 'react-router-dom';
import { CATEGORIES } from '../db/db';
import { useProducts } from '../db/queries';
import { ReceiptScreen } from '../design/ReceiptScreen';
import { Barcode, DottedLine, PerforationLine, ReceiptPaper, ScanBrackets } from '../design/parts';
import { CATEGORY_ICONS, Icon } from '../design/Icon';

/** S01 홈 — 카테고리별 제품 수를 집계해 영수증 표로 보여준다. */
export function Home() {
  const navigate = useNavigate();
  const { data: products = [] } = useProducts();

  const count = (category: string) => products.filter((p) => p.category === category).length;

  return (
    <ReceiptScreen>
      <ReceiptPaper>
        <div className="pad">
          <div className="receipt-header">
            <span className="logo">New.</span>
            <button onClick={() => navigate('/search')} aria-label="제품 검색">
              <Icon name="magnifyingglass" size={21} color="var(--icon-pink)" />
            </button>
          </div>

          <div style={{ height: 26 }} />
          <PerforationLine />
          <div style={{ height: 34 }} />

          <div className="col-head">
            <span>Item</span>
            <span>Review</span>
          </div>

          <div style={{ height: 9 }} />
          <div className="rule" />

          {CATEGORIES.map((category, index) => (
            <div key={category}>
              {index > 0 && <DottedLine />}
              <button className="category-row" onClick={() => navigate(`/c/${category}`)}>
                <span className="item">
                  <Icon
                    name={CATEGORY_ICONS[category]}
                    size={18}
                    weight={1.6}
                    color="var(--icon-pink)"
                  />
                  <span className="name">{category}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="count">{count(category)}</span>
                  <Icon name="chevron.right" size={15} color="var(--icon-pink)" />
                </span>
              </button>
            </div>
          ))}

          <div style={{ height: 12 }} />
          <div className="rule" />
          <div style={{ height: 32 }} />

          <button className="scan-block" onClick={() => navigate('/scan')}>
            <Barcode height={70} />
            <span className="label">TAP BARCODE TO SCAN</span>
            <ScanBrackets arm={24} />
          </button>
        </div>
      </ReceiptPaper>
    </ReceiptScreen>
  );
}
