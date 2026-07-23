import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ReceiptHeader, ReceiptScreen } from '../design/ReceiptScreen';
import { PerforationLine, ReceiptPaper, ScanBrackets } from '../design/parts';
import { Icon } from '../design/Icon';
import { grabFrame, useCamera } from '../lib/camera';
import { cutout, preloadCutoutModel } from '../lib/cutout';
import { setPendingPhoto } from '../lib/pendingPhoto';

/** 촬영 가이드 창. 이 영역이 그대로 누끼의 크롭 기준이 된다. */
const WINDOW_WIDTH = 248;
const WINDOW_HEIGHT = 210;

/** S05 제품 사진 — 촬영 → 누끼 → S06 으로 이미지 전달.
 *
 * 사진이 필수라 이 화면에는 우회로가 없다. 카메라가 막혔을 때는 파일 선택으로 길을 연다. */
export function ProductPhotoScreen() {
  const { barcode = '' } = useParams();
  const navigate = useNavigate();
  const { videoRef, status, stop } = useCamera(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);

  // 촬영 후에 모델을 받으면 셔터를 누르고 수십 초를 기다린다.
  // 구도를 잡는 동안 미리 받아 둔다.
  useEffect(() => {
    void preloadCutoutModel();
  }, []);

  async function process(source: Blob) {
    setProcessing(true);
    setError(undefined);
    try {
      const result = await cutout(source, WINDOW_WIDTH / WINDOW_HEIGHT);
      setPendingPhoto({ barcode, blob: result.blob, isCutout: result.isCutout });
      stop();
      navigate(`/p/${barcode}/write`, { replace: true });
    } catch {
      setError('사진을 처리하지 못했어요. 다시 시도해주세요.');
      setProcessing(false);
    }
  }

  async function capture() {
    if (!videoRef.current) return;
    try {
      await process(await grabFrame(videoRef.current));
    } catch {
      setError('사진을 찍지 못했어요. 다시 시도해주세요.');
      setProcessing(false);
    }
  }

  const title = processing
    ? '배경을 지우는 중이에요'
    : status.kind === 'denied'
      ? '카메라 권한이 꺼져 있어요'
      : status.kind === 'failed'
        ? status.message
        : (error ?? '제품 앞면이 잘 보이게 담아주세요');

  const subtitle =
    status.kind === 'denied' || status.kind === 'failed'
      ? '사진 파일을 골라도 등록할 수 있어요'
      : '배경은 자동으로 지워집니다';

  return (
    <ReceiptScreen dark scrolls={false}>
      <ReceiptPaper>
        <div className="pad" style={{ paddingBottom: 26 }}>
          <ReceiptHeader trailingIcon="xmark" onAction={() => navigate('/', { replace: true })} />

          <div style={{ height: 20 }} />
          <PerforationLine />
          <div style={{ height: 20 }} />

          <div
            className="mono center"
            style={{ fontWeight: 700, fontSize: 11, letterSpacing: 2.2, color: 'var(--pink)' }}
          >
            STEP 1 · 제품 사진
          </div>

          <div style={{ height: 14 }} />

          <div className="camera-window" style={{ height: WINDOW_HEIGHT, background: '#26221F' }}>
            <video ref={videoRef} playsInline muted />
            {status.kind !== 'running' && (
              <div className="fill">
                <Icon name="camera.fill" size={26} color="var(--icon-on-pink)" />
              </div>
            )}
            {processing && (
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
          <div className="center" style={{ fontSize: 12, color: 'var(--ink3)' }}>
            {subtitle}
          </div>

          <div style={{ height: 22 }} />

          {status.kind === 'running' && (
            <button className="shutter" onClick={capture} disabled={processing} aria-label="촬영">
              <i />
            </button>
          )}

          <div style={{ height: 14 }} />

          {/* 권한을 거부했거나 촬영을 취소하면 등록 자체가 막히므로 대안을 남긴다 */}
          <button
            style={{ width: '100%', fontSize: 13, fontWeight: 500, color: 'var(--ink3)' }}
            onClick={() => fileRef.current?.click()}
            disabled={processing}
          >
            사진 파일에서 고르기
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void process(file);
            }}
          />
        </div>
      </ReceiptPaper>
    </ReceiptScreen>
  );
}
