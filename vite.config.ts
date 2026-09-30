/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// O build gera um único index.html autocontido (JS, CSS, fontes e imagens
// embutidos), que pode ser hospedado em qualquer lugar ou enviado por e-mail
// e aberto direto no navegador.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  test: {
    globals: true,
    css: false,
    // Fluxos de interface digitam em tabelas inteiras; com cobertura ligada passam de 5 s.
    testTimeout: 15000,
    // O app roda em jsdom com o setup da Testing Library; o servidor, em Node puro.
    projects: [
      {
        extends: true,
        test: { name: 'app', environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'], setupFiles: ['./src/test/setup.ts'] },
      },
      {
        extends: true,
        test: { name: 'servidor', environment: 'node', include: ['server/**/*.test.ts'] },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'server/**/*.ts'],
      exclude: ['**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/env.d.ts', 'server/main.ts'],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 75 },
    },
  },
})
