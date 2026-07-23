import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // 실기기에서 확인하려면 같은 네트워크에서 접속해야 한다.
    // 카메라는 HTTPS 또는 localhost 에서만 열린다 — 실기기 테스트는 터널/mkcert 필요.
    host: true,
    port: 5173,
  },
  // background-removal 이 큰 wasm/onnx 를 동적으로 받아온다. 사전 번들 대상에서 뺀다.
  optimizeDeps: {
    exclude: ['@imgly/background-removal'],
  },
});
