import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 레포의 다른 앱(5173·5174)과 겹치지 않게 고정 — 비어 있지 않으면 다음 번호로 넘어간다.
  server: { port: 5180 },
})
