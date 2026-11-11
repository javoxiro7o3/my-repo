import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

const alias = {
  '@shared': resolve(__dirname, 'src/shared'),
  '@content': resolve(__dirname, 'src/content'),
  '@': resolve(__dirname, 'src/renderer/src')
}

const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; worker-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'"
// Qat'iy CSP faqat production build ga qo'shiladi (dev rejimida Vite HMR inline skript ishlatadi)
const cspPlugin = () => ({ name: 'da-csp', apply: 'build' as const, transformIndexHtml: (html: string) => html.replace('<!--CSP-->', `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`) })

export default defineConfig({
  main: { resolve: { alias }, build: { rollupOptions: { external: ['better-sqlite3'] } } },
  preload: { resolve: { alias }, build: { rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].js' } } } },
  renderer: {
    resolve: { alias },
    plugins: [react(), cspPlugin()],
    build: { chunkSizeWarningLimit: 6000 }
  }
})
