import { useEffect, useRef } from 'react'
import * as monaco from 'monaco-editor/editor.js'
import 'monaco-editor/languages/definitions/yaml/register.js'
import 'monaco-editor/languages/definitions/dockerfile/register.js'
import 'monaco-editor/languages/definitions/hcl/register.js'
import 'monaco-editor/languages/definitions/shell/register.js'
import 'monaco-editor/languages/definitions/python/register.js'
import 'monaco-editor/languages/definitions/ini/register.js'
import 'monaco-editor/languages/definitions/javascript/register.js'
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker'
import { useApp, resolveTheme } from '@/store/app'

;(self as any).MonacoEnvironment = { getWorker: () => new EditorWorker() }

let registered = false
function setup() {
  if (registered) return
  registered = true
  // Nginx conf uchun Monarch tokenizer (Monaco da standart yo'q)
  monaco.languages.register({ id: 'nginx' })
  monaco.languages.setMonarchTokensProvider('nginx', {
    tokenizer: {
      root: [
        [/#.*$/, 'comment'],
        [/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/, 'string'],
        [/\$[a-zA-Z_]\w*/, 'variable'],
        [/\b(server|location|upstream|http|events|if|map|types|stream|geo|limit_except)\b/, 'keyword'],
        [/^\s*[a-z_]+(?=\s|;)/, 'type'],
        [/\b\d+[kmgsdhwMy]?\b/, 'number'],
        [/[{};]/, 'delimiter']
      ]
    }
  } as monaco.languages.IMonarchLanguage)
  monaco.languages.register({ id: 'json' })
  monaco.languages.setMonarchTokensProvider('json', { tokenizer: { root: [[/"([^"\\]|\\.)*"(?=\s*:)/, 'type'], [/"([^"\\]|\\.)*"/, 'string'], [/-?\d+(\.\d+)?/, 'number'], [/\b(true|false|null)\b/, 'keyword']] } } as monaco.languages.IMonarchLanguage)
  const base = { inherit: true, rules: [] as monaco.editor.ITokenThemeRule[] }
  monaco.editor.defineTheme('da-dark', { base: 'vs-dark', ...base, colors: { 'editor.background': '#141726', 'editor.lineHighlightBackground': '#1c2036', 'editorLineNumber.foreground': '#555b7a', 'editorGutter.background': '#141726' } })
  monaco.editor.defineTheme('da-light', { base: 'vs', ...base, colors: { 'editor.background': '#ffffff' } })
  monaco.editor.defineTheme('da-terminal', { base: 'vs-dark', inherit: true, rules: [{ token: '', foreground: '7fe89a' }, { token: 'comment', foreground: '3f8f52' }, { token: 'keyword', foreground: '4dffd2' }, { token: 'string', foreground: 'd9f76a' }], colors: { 'editor.background': '#0b120d', 'editorLineNumber.foreground': '#2f6b3d', 'editor.lineHighlightBackground': '#0f1a12' } })
}

export const LANGS = [
  { id: 'dockerfile', label: 'Dockerfile' }, { id: 'yaml', label: 'YAML (Compose / K8s / CI)' }, { id: 'hcl', label: 'Terraform (HCL)' },
  { id: 'nginx', label: 'Nginx conf' }, { id: 'shell', label: 'Bash' }, { id: 'python', label: 'Python' }, { id: 'ini', label: 'INI / systemd unit' }, { id: 'json', label: 'JSON' }
]
const alias: Record<string, string> = { bash: 'shell', sh: 'shell', yml: 'yaml', tf: 'hcl', terraform: 'hcl', docker: 'dockerfile', conf: 'nginx', systemd: 'ini', toml: 'ini', js: 'javascript' }

export interface Marker { line: number; message: string; severity?: 'error' | 'warning' | 'info' }

export default function Monaco({ value, onChange, language, height = 320, readOnly, markers, ariaLabel }: { value: string; onChange?: (v: string) => void; language: string; height?: number | string; readOnly?: boolean; markers?: Marker[]; ariaLabel?: string }) {
  const el = useRef<HTMLDivElement>(null)
  const ed = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const cb = useRef(onChange); cb.current = onChange
  const theme = useApp((s) => resolveTheme(s.settings?.theme ?? 'dark'))
  const lang = alias[language] ?? language

  useEffect(() => {
    setup()
    const e = monaco.editor.create(el.current!, {
      value, language: lang, readOnly, automaticLayout: true, minimap: { enabled: false }, fontFamily: '"JetBrains Mono", monospace', fontSize: 13.5, lineHeight: 21,
      scrollBeyondLastLine: false, tabSize: 2, renderLineHighlight: 'line', padding: { top: 10, bottom: 10 }, smoothScrolling: true, wordWrap: 'on',
      ariaLabel: ariaLabel ?? 'Kod muharriri', scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 }, overviewRulerLanes: 0, contextmenu: false
    })
    ed.current = e
    const sub = e.onDidChangeModelContent(() => cb.current?.(e.getValue()))
    return () => { sub.dispose(); e.getModel()?.dispose(); e.dispose() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { monaco.editor.setTheme(`da-${theme}`) }, [theme])
  useEffect(() => { const m = ed.current?.getModel(); if (m) monaco.editor.setModelLanguage(m, lang) }, [lang])
  useEffect(() => { const e = ed.current; if (e && e.getValue() !== value) e.setValue(value) }, [value])
  useEffect(() => {
    const m = ed.current?.getModel(); if (!m) return
    monaco.editor.setModelMarkers(m, 'da', (markers ?? []).map((k) => ({ startLineNumber: k.line, endLineNumber: k.line, startColumn: 1, endColumn: m.getLineMaxColumn(Math.min(k.line, m.getLineCount())), message: k.message, severity: k.severity === 'warning' ? monaco.MarkerSeverity.Warning : k.severity === 'info' ? monaco.MarkerSeverity.Info : monaco.MarkerSeverity.Error })))
  }, [markers])
  return <div ref={el} style={{ height }} className="overflow-hidden rounded-xl border" />
}
