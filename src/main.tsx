import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { seedIfNeeded } from './db/db';
import { installAudioUnlock } from './lib/feedSound';
import './styles.css';

// 렌더를 시드에 매달지 않는다. IndexedDB 가 막히거나(사생활 보호 모드) 업그레이드가 걸리면
// 화면이 통째로 안 뜬다. 시드는 뒤에서 넣고, 들어오는 대로 liveQuery 가 화면을 갱신한다.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// iOS 는 제스처 안에서 한 번 재생해야 오디오가 열린다. 화면 어디든 첫 조작에서 풀어 둔다 —
// 홈에서 카테고리를 누르는 탭이 해제 시점이 되어, S07 자동 급지부터 소리가 난다.
installAudioUnlock();

// 마일스톤 1·2 는 카메라 없이 확인한다 — 첫 실행에 더미를 넣는다.
void seedIfNeeded().catch(() => undefined);
