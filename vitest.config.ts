import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// 단위 테스트(npm test) — 화면 코드(src)의 *.test.ts만 돈다. apps/(RN 앱)는 자기 jest를 쓴다.
export default mergeConfig(viteConfig, defineConfig({ test: { include: ['src/**/*.test.ts'] } }))
