import { useNavigate, useParams } from 'react-router-dom';
import { averageRating, shortRelative, type Review } from '../db/db';
import { useProduct, useReviews } from '../db/queries';
import { ReceiptScreen, StarRating } from '../design/ReceiptScreen';
import { DottedLine, PerforationLine, ReceiptPaper } from '../design/parts';
import { Icon } from '../design/Icon';
import { ProductPhoto } from '../lib/photo';

/** S03 제품 — 제품 정보 + 리뷰 목록. `리뷰 쓰기` 는 S06 을 리뷰 전용 모드로 연다. */
export function ProductPage() {
  const { barcode = '' } = useParams();
  const navigate = useNavigate();

  const { data: product } = useProduct(barcode);
  const { data: reviews = [] } = useReviews(barcode);

  if (product === undefined) {
    return (
      <ReceiptScreen>
        <ReceiptPaper>
          <div style={{ padding: '60px 26px', textAlign: 'center', color: 'var(--ink2)' }} />
        </ReceiptPaper>
      </ReceiptScreen>
    );
  }

  if (product === null) {
    return (
      <ReceiptScreen>
        <ReceiptPaper>
          <div
            style={{
              padding: '60px 26px',
              textAlign: 'center',
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--ink2)',
            }}
          >
            제품을 찾을 수 없어요
          </div>
        </ReceiptPaper>
      </ReceiptScreen>
    );
  }

  return (
    <ReceiptScreen>
      <ReceiptPaper>
        <div className="pad" style={{ paddingBottom: 24 }}>
          <div className="receipt-header">
            <button
              className="logo"
              style={{ fontSize: 40, letterSpacing: -1.4 }}
              onClick={() => navigate(-1)}
            >
              Review
            </button>
            <button onClick={() => navigate('/search')} aria-label="제품 검색">
              <Icon name="magnifyingglass" size={20} color="var(--icon-pink)" />
            </button>
          </div>

          <div style={{ height: 20 }} />
          <PerforationLine />
          <div style={{ height: 26 }} />

          <ProductPhoto path={product.photoPath} height={175} />

          <div style={{ height: 22 }} />
          <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--pink)' }}>{product.name}</div>

          <div style={{ height: 13 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <StarRating rating={averageRating(reviews)} size={19} spacing={5} />
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--pink)' }}>
              ({reviews.length})
            </span>
          </div>

          <div style={{ height: 24 }} />
          <PerforationLine />
          <div style={{ height: 22 }} />

          <div className="feed-meta">
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: 0.6,
                color: 'var(--pink)',
              }}
            >
              REVIEWS
            </span>
            <button
              className="write-review"
              onClick={() => navigate(`/p/${barcode}/write`)}
            >
              리뷰 쓰기
              <Icon name="pencil.line" size={11} color="var(--icon-pink)" />
            </button>
          </div>

          <div style={{ height: 8 }} />

          {reviews.length === 0 ? (
            <div style={{ padding: '24px 0', fontSize: 13, color: 'var(--ink3)' }}>
              아직 리뷰가 없어요. 첫 리뷰를 남겨보세요.
            </div>
          ) : (
            reviews.map((review, index) => (
              <div key={review.id}>
                {index > 0 && <DottedLine thickness={1.5} color="var(--pink-tint)" />}
                <ReviewRow review={review} />
              </div>
            ))
          )}
        </div>
      </ReceiptPaper>
    </ReceiptScreen>
  );
}

function ReviewRow({ review }: { review: Review }) {
  return (
    <div className="review-row">
      <div className="review-meta">
        <StarRating rating={review.rating} size={12} />
        <span>· {shortRelative(review.createdAt)}</span>
      </div>

      {review.body && <div className="review-body">{review.body}</div>}

      {review.keywords.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {review.keywords.map((keyword) => (
            <span key={keyword} className="keyword">
              {keyword}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
