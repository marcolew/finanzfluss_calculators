import { defineConfig } from 'tsdown/config'

export default defineConfig({
  entry: ['src/index.ts', 'src/utils/index.ts'],
  dts: true,
})
