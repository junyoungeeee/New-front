import { useNavigate, useParams } from 'react-router-dom';
import { GlassButton, ReceiptHeader, ReceiptScreen } from '../design/ReceiptScreen';
import { Barcode, PerforationLine, ReceiptPaper } from '../design/parts';
import { Icon } from '../design/Icon';

/** S04 없는 제품 — 스캔은 됐지만 등록된 게 없을 때. CTA 는 곧바로 S05 로. */
export function NotFound() {
  const { barcode = '' } = useParams();
  const navigate = useNavigate();

  return (
    <ReceiptScreen scrolls={false}>
      <ReceiptPaper>
        <div className="pad" style={{ paddingBottom: 26 }}>
          <ReceiptHeader trailingIcon="xmark" onAction={() => navigate('/', { replace: true })} />

          <div style={{ height: 20 }} />
          <PerforationLine />
          <div style={{ height: 24 }} />

          <div
            className="mono center"
            style={{ fontWeight: 700, fontSize: 12.5, letterSpacing: 2.4, color: 'var(--pink)' }}
          >
            NO MATCH FOUND
          </div>

          <div style={{ height: 16 }} />
          <Barcode height={62} />
          <div style={{ height: 10 }} />

          <div
            className="mono center"
            style={{ fontSize: 11.5, letterSpacing: 2, color: 'var(--ink2)' }}
          >
            {formatted(barcode)}
          </div>

          <div style={{ height: 24 }} />
          <PerforationLine />
          <div style={{ height: 24 }} />

          <div className="center" style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.45 }}>
            아직 등록되지 않은
            <br />
            제품이에요
          </div>

          <div style={{ height: 10 }} />

          <div
            className="center"
            style={{ fontSize: 13, lineHeight: 1.75, color: 'var(--ink2)' }}
          >
            가장 먼저 이 제품을 등록하고
            <br />첫 번째 리뷰를 남겨보세요.
          </div>

          <div style={{ height: 26 }} />

          <GlassButton
            icon="plus"
            title="제품 등록하고 리뷰 쓰기"
            onClick={() => navigate(`/p/${barcode}/photo`, { replace: true })}
          />

          <div style={{ height: 14 }} />

          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              width: '100%',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--ink3)',
            }}
            onClick={() => navigate('/scan', { replace: true })}
          >
            <Icon name="arrow.counterclockwise" size={12} color="var(--icon-ink)" />
            다시 스캔하기
          </button>
        </div>
      </ReceiptPaper>
    </ReceiptScreen>
  );
}

/** EAN-13 을 "8 801234 567890" 처럼 끊어 읽는다. */
function formatted(code: string) {
  if (code.length !== 13) return code;
  return `${code[0]} ${code.slice(1, 7)} ${code.slice(7)}`;
}
