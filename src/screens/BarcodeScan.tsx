import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProduct } from '../db/db';
import { ReceiptScreen, ReceiptHeader } from '../design/ReceiptScreen';
import { PerforationLine, ReceiptPaper, ScanBrackets } from '../design/parts';
import { Icon } from '../design/Icon';
import { useCamera } from '../lib/camera';
import { createScanner } from '../lib/barcode';

/** 프리뷰가 영수증 안의 248×206 창에만 보인다. 이 비율이 그대로 디코딩 관심영역이 된다. */
const WINDOW_WIDTH = 248;
const WINDOW_HEIGHT = 206;

/** S02 바코드 스캔 */
export function BarcodeScan() {
  const navigate = useNavigate();
  const { videoRef, status, stop } = useCamera(true);
  const [busy, setBusy] = useState(false);
  const foundRef = useRef(false);

  async function handleBarcode(barcode: string) {
    if (foundRef.current) return;
    foundRef.current = true;
    stop(); // 첫 인식 후 카메라를 놓는다 — iOS 는 안 놓으면 다음 화면에서 못 연다
    setBusy(true);

    // 한 번 등록한 바코드는 다음부터 자동으로 채워진다 — MVP 에서 "이미 등록된 제품"의 의미.
    const existing = await getProduct(barcode).catch(() => null);
    navigate(existing ? `/p/${barcode}` : `/p/${barcode}/new`, { replace: true });
  }

  useEffect(() => {
    if (status.kind !== 'running') return;
    const scan = createScanner(WINDOW_WIDTH / WINDOW_HEIGHT);
    let stopped = false;

    // 매 프레임은 과하다. 8fps 정도면 손으로 대는 속도를 충분히 따라간다.
    const timer = window.setInterval(async () => {
      if (stopped || foundRef.current || !videoRef.current) return;
      try {
        const text = await scan(videoRef.current);
        if (text) void handleBarcode(text);
      } catch {
        // 디코딩 실패는 정상 — 다음 프레임에서 다시 시도한다
      }
    }, 125);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.kind]);

  function manualEntry() {
    const code = window.prompt('바코드 번호를 입력하세요', '8801234567890')?.trim();
    if (code) void handleBarcode(code);
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
            SCAN MODE
          </div>

          <div style={{ height: 14 }} />

          <div className="camera-window" style={{ height: WINDOW_HEIGHT }}>
            <video ref={videoRef} playsInline muted />
            {status.kind === 'running' && <div className="scan-line" />}
            {status.kind !== 'running' && (
              <div className="fill">
                <Icon name="camera.fill" size={26} color="var(--icon-on-pink)" />
              </div>
            )}
            {busy && (
              <div className="processing">
                <div className="spinner" />
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
        </div>
      </ReceiptPaper>
    </ReceiptScreen>
  );
}
