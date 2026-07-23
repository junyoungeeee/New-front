import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { installAudioUnlock } from './lib/feedSound';
import { ensureSession } from './lib/supabase';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 영수증 목록이 초 단위로 바뀌지는 않는다. 화면을 오갈 때마다 다시 부르지 않게 둔다.
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);

// iOS 는 제스처 안에서 한 번 재생해야 오디오가 열린다. 화면 어디든 첫 조작에서 풀어 둔다 —
// 홈에서 카테고리를 누르는 탭이 해제 시점이 되어, S07 자동 급지부터 소리가 난다.
installAudioUnlock();

// 리뷰에 작성자를 붙이기 위한 익명 세션. 꺼져 있어도 앱은 돌아간다.
void ensureSession().catch(() => undefined);
