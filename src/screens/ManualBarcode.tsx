import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProduct } from '../db/db';
import { GlassButton, ReceiptHeader, ReceiptScreen } from '../design/ReceiptScreen';
import { PerforationLine, ReceiptPaper } from '../design/parts';

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

/** S02-b 바코드 직접 입력.
 *
 * 카메라가 막히거나(노트북·권한 거부) 잘 안 읽힐 때의 우회로. 예전엔 `window.prompt` 로 받았는데
 * 모바일 사파리에서 이 대화상자가 막히거나 뜨지 않는 기기가 있어 아예 화면으로 뺐다 —
 * 폰이든 노트북 웹이든 똑같이 동작하는 입력창을 둔다. */
export function ManualBarcode() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  // GlassButton 은 form 안에서 submit 이라 클릭 한 번에 onClick·onSubmit 이 겹쳐 불린다 — 재진입 차단.
  const submittingRef = useRef(false);

  // 숫자만, 최대 13자리. 붙여넣기·자동완성으로 들어온 공백·하이픈도 걸러낸다.
  const clean = code.replace(/\D/g, '').slice(0, 13);
  const checksum = ean13Ok(clean);
  const canSubmit = clean.length >= 8 && !busy; // EAN-8 이상이면 넘어갈 수 있게 둔다

  async function submit() {
    if (!canSubmit || submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    // 등록 여부에 따라 제품 페이지 / 신규 등록으로. 스캔 확인 화면과 같은 분기.
    const existing = await getProduct(clean).catch(() => null);
    navigate(existing ? `/p/${clean}` : `/p/${clean}/new`, { replace: true });
  }

  return (
    <ReceiptScreen scrolls={false}>
      <ReceiptPaper>
        <div className="pad" style={{ paddingBottom: 26 }}>
          <ReceiptHeader
            title=""
            trailingIcon="xmark"
            onAction={() => navigate('/scan', { replace: true })}
          />

          <div style={{ height: 20 }} />
          <PerforationLine />
          <div style={{ height: 22 }} />

          <div
            className="mono center"
            style={{ fontWeight: 700, fontSize: 11, letterSpacing: 2.4, color: 'var(--pink)' }}
          >
            MANUAL ENTRY
          </div>

          <div style={{ height: 20 }} />

          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <div className="field-label">바코드 번호</div>
            <input
              className="underline-input"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 20,
                letterSpacing: 2,
                textAlign: 'center',
              }}
              autoFocus
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="숫자 13자리"
              value={code}
              maxLength={17}
              onChange={(event) => setCode(event.target.value)}
              enterKeyHint="go"
            />

            <div style={{ height: 12 }} />
            <div
              className="mono center"
              style={{ fontSize: 13, letterSpacing: 1.5, color: 'var(--ink3)', minHeight: 18 }}
            >
              {clean ? formatted(clean) : '제품 포장의 숫자를 그대로 입력하세요'}
            </div>

            {checksum === false && (
              <>
                <div style={{ height: 10 }} />
                <div className="center" style={{ fontSize: 12, color: 'var(--pink)' }}>
                  ⚠ 유효한 바코드 번호가 아니에요. 숫자를 다시 확인해주세요.
                </div>
              </>
            )}

            <div style={{ height: 26 }} />
            <GlassButton
              icon="plus"
              title={busy ? '확인하는 중…' : '다음'}
              disabled={!canSubmit}
              onClick={submit}
            />
          </form>
        </div>
      </ReceiptPaper>
    </ReceiptScreen>
  );
}
