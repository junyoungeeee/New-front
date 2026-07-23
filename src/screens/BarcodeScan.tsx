import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProduct } from '../db/db';
import { GlassButton, ReceiptScreen, ReceiptHeader } from '../design/ReceiptScreen';
import { Barcode, PerforationLine, ReceiptPaper, ScanBrackets } from '../design/parts';
import { Icon } from '../design/Icon';
import { useCamera } from '../lib/camera';
import { createScanner } from '../lib/barcode';

/** 프리뷰가 영수증 안의 248×206 창에만 보인다. 이 비율이 그대로 디코딩 관심영역이 된다. */
const WINDOW_WIDTH = 248;
const WINDOW_HEIGHT = 206;

/** EAN-13 을 "8 801234 567890" 처럼 끊어 읽는다. */
function formatted(code: string) {
  if (code.length !== 13) return code;
  return `${code[0]} ${code.slice(1, 7)} ${code.slice(7)}`;
}

/** EAN-13 체크디짓 검사. 13자리가 아니면 판단하지 않는다(EAN-8·UPC-E 등). */
function ean13Ok(code: string): boolean | null {
  if (!/^\d{13}$/.test(code)) return null;
  const digits = [...code].map(Number);
  const sum = digits.slice(0, 12).reduce((acc, d, i) => acc + d * (i % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === digits[12];
}

/** S02 바코드 스캔 */
export function BarcodeScan() {
  const navigate = useNavigate();
  /** 확인 중에는 카메라를 놓는다 — 계속 물고 있으면 뒤에서 또 인식된다. */
  const [pending, setPending] = useState<string | null>(null);
  const { videoRef, status, stop } = useCamera(pending === null);
  const [busy, setBusy] = useState(false);
  const foundRef = useRef(false);

  function handleBarcode(barcode: string) {
    if (foundRef.current) return;
    foundRef.current = true;
    stop(); // iOS 는 스트림을 안 놓으면 다음 화면에서 카메라를 다시 못 연다
    setPending(barcode);
  }

  /** 제품 등록은 되돌릴 수 없다 — 바코드가 주키인데 아무도 고치거나 지울 수 없다.
   *  그래서 넘어가기 전에 사람 눈으로 한 번 확인받는다. */
  async function confirmBarcode() {
    if (!pending) return;
    setBusy(true);
    const existing = await getProduct(pending).catch(() => null);
    navigate(existing ? `/p/${pending}` : `/p/${pending}/new`, { replace: true });
  }

  function rescan() {
    foundRef.current = false;
    setPending(null);
  }

  useEffect(() => {
    if (pending || status.kind !== 'running') return;
    const scan = createScanner(WINDOW_WIDTH / WINDOW_HEIGHT);
    let stopped = false;

    // 매 프레임은 과하다. 8fps 정도면 손으로 대는 속도를 충분히 따라간다.
    const timer = window.setInterval(async () => {
      if (stopped || foundRef.current || !videoRef.current) return;
      try {
        const text = await scan(videoRef.current);
        if (text) handleBarcode(text);
      } catch {
        // 디코딩 실패는 정상 — 다음 프레임에서 다시 시도한다
      }
    }, 125);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.kind, pending]);

  function manualEntry() {
    const code = window.prompt('바코드 번호를 입력하세요', '8801234567890')?.trim();
    if (code) handleBarcode(code);
  }

  const title =
    status.kind === 'denied'
      ? '카메라 권한이 꺼져 있어요'
      : status.kind === 'failed'
        ? status.message
        : '바코드를 사각형 안에 맞춰주세요';

  const subtitle =
    status.kind === 'denied'
      ? '주소창 왼쪽 아이콘에서 허용할 수 있어요'
      : status.kind === 'running'
        ? 'SEARCHING…'
        : 'READY';

  const checksum = pending ? ean13Ok(pending) : null;

  return (
    <ReceiptScreen dark scrolls={false}>
      <ReceiptPaper>
        <div className="pad" style={{ paddingBottom: 26 }}>
          <ReceiptHeader trailingIcon="xmark" onAction={() => navigate('/', { replace: true })} />

          <div style={{ height: 20 }} />
          <PerforationLine />
          <div style={{ height: 22 }} />

          <div
            className="mono center"
            style={{ fontWeight: 700, fontSize: 11, letterSpacing: 2.4, color: 'var(--pink)' }}
          >
            {pending ? 'CONFIRM' : 'SCAN MODE'}
          </div>

          <div style={{ height: 14 }} />

          {pending ? (
            <>
              {/* 읽어낸 번호를 크게 보여준다 — 눈으로 대조하는 게 이 화면의 전부다 */}
              <Barcode height={62} />
              <div style={{ height: 12 }} />
              <div
                className="mono center"
                style={{ fontSize: 15, letterSpacing: 2, color: 'var(--ink)' }}
              >
                {formatted(pending)}
              </div>

              <div style={{ height: 20 }} />
              <div className="center" style={{ fontSize: 13.5, fontWeight: 700 }}>
                이 번호가 맞나요?
              </div>
              <div style={{ height: 8 }} />
              <div
                className="center"
                style={{ fontSize: 12, lineHeight: 1.65, color: 'var(--ink3)' }}
              >
                제품 포장의 숫자와 같은지 확인해주세요.
              </div>

              {checksum === false && (
                <>
                  <div style={{ height: 12 }} />
                  <div className="center" style={{ fontSize: 12, color: 'var(--pink)' }}>
                    ⚠ 유효한 바코드 번호가 아니에요. 잘못 읽혔을 수 있어요.
                  </div>
                </>
              )}

              <div style={{ height: 24 }} />
              <GlassButton
                icon="plus"
                title={busy ? '확인하는 중…' : '맞아요'}
                disabled={busy}
                onClick={confirmBarcode}
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
                onClick={rescan}
                disabled={busy}
              >
                <Icon name="arrow.counterclockwise" size={12} color="var(--icon-ink)" />
                다시 스캔하기
              </button>
            </>
          ) : (
            <>
              <div className="camera-window" style={{ height: WINDOW_HEIGHT }}>
                <video ref={videoRef} playsInline muted />
                {status.kind === 'running' && <div className="scan-line" />}
                {status.kind !== 'running' && (
                  <div className="fill">
                    <Icon name="camera.fill" size={26} color="var(--icon-on-pink)" />
                  </div>
                )}
                <ScanBrackets arm={28} />
              </div>

              <div style={{ height: 18 }} />
              <div className="center" style={{ fontSize: 13.5, fontWeight: 700 }}>
                {title}
              </div>

              <div style={{ height: 8 }} />
              <div
                className="mono center"
                style={{ fontSize: 10.5, letterSpacing: 2.4, color: 'var(--pink)' }}
              >
                {subtitle}
              </div>

              <div style={{ height: 24 }} />
              <PerforationLine />
              <div style={{ height: 20 }} />

              {/* 카메라가 막히면 등록 자체가 막히므로 우회로를 남긴다 */}
              <button className="ink-button" onClick={manualEntry}>
                <Icon name="keyboard" size={15} color="var(--icon-ink)" />
                바코드 번호 직접 입력
              </button>
            </>
          )}
        </div>
      </ReceiptPaper>
    </ReceiptScreen>
  );
}
