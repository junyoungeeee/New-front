import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

const DISMISSED_KEY = 'new-app.install-dismissed';

/** iOS Safari 는 상호작용 없이 7일이 지나면 IndexedDB 를 포함한 저장소를 지운다.
 *  홈화면에 추가한 웹앱만 예외다. 로컬 온리로 가기로 한 이상 설치 유도는 부가 기능이 아니라
 *  데이터 보존 수단이다(MVP-web.md §5.4).
 *
 *  띄우는 시점이 중요하다 — 앱을 열자마자가 아니라 **첫 등록을 마친 뒤**, 잃을 게 생긴 다음이다. */
export function InstallHint() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === '1');
  const [installEvent, setInstallEvent] = useState<Event & { prompt?: () => void }>();
  const reviewCount = useLiveQuery(() => db.reviews.count(), [], 0);
  // 시드 리뷰는 사용자의 것이 아니다. 이 세션에서 직접 저장한 경우만 "잃을 게 생겼다"고 본다.
  const [ownReview, setOwnReview] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    // 등록 직후 저장소 지속성을 먼저 요청한다. 승인되면 자동 삭제 대상에서 빠진다.
    // Safari 는 대체로 거절하므로 안내가 여전히 필요하다.
    if (ownReview) void navigator.storage?.persist?.();
  }, [ownReview]);

  useEffect(() => {
    const onSaved = () => setOwnReview(true);
    window.addEventListener('new-app:review-saved', onSaved);
    return () => window.removeEventListener('new-app:review-saved', onSaved);
  }, []);

  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true;

  if (standalone || dismissed || !ownReview || reviewCount === 0) return null;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  function close() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  }

  return (
    <div className="install-sheet">
      <h3>홈 화면에 추가해두세요</h3>
      <p>
        {isIOS
          ? '이 브라우저는 한동안 안 쓰면 저장된 리뷰를 지웁니다. 공유 버튼 → “홈 화면에 추가”를 하면 안전하게 남아요.'
          : '앱으로 설치해두면 저장된 리뷰가 안전하게 남고, 전체화면으로 열려요.'}
      </p>
      <div className="row">
        {installEvent?.prompt && (
          <button
            className="glass-button"
            onClick={() => {
              installEvent.prompt?.();
              close();
            }}
          >
            설치하기
          </button>
        )}
        <button style={{ fontSize: 12.5, color: 'var(--ink3)', flex: 'none' }} onClick={close}>
          나중에
        </button>
      </div>
    </div>
  );
}
