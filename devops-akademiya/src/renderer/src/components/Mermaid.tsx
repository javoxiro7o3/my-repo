import { useEffect, useId, useState } from 'react'
import { Maximize2 } from 'lucide-react'
import { useApp, resolveTheme } from '@/store/app'
import { Modal, Button } from './ui'

let loader: Promise<typeof import('mermaid')['default']> | null = null
const load = () => (loader ??= import('mermaid').then((m) => m.default))

const VARS = {
  dark: { background: 'transparent', primaryColor: '#232846', primaryTextColor: '#e6e8f7', primaryBorderColor: '#6f74f2', lineColor: '#8b90b8', secondaryColor: '#1b3340', tertiaryColor: '#171a2c', noteBkgColor: '#2a2440', noteTextColor: '#e6e8f7', actorBkg: '#232846', actorBorder: '#6f74f2', signalColor: '#b9bde0', signalTextColor: '#e6e8f7', labelBoxBkgColor: '#232846', edgeLabelBackground: '#171a2c', clusterBkg: '#151829', clusterBorder: '#353a5c' },
  light: { background: 'transparent', primaryColor: '#eef0ff', primaryTextColor: '#1a1d33', primaryBorderColor: '#5b5fe0', lineColor: '#5a5f80', secondaryColor: '#e3f6fb', tertiaryColor: '#f6f7fb', noteBkgColor: '#fff6d6', noteTextColor: '#1a1d33', edgeLabelBackground: '#ffffff', clusterBkg: '#f6f7fb', clusterBorder: '#c9cce0' },
  terminal: { background: 'transparent', primaryColor: '#0f1f13', primaryTextColor: '#86efa0', primaryBorderColor: '#2bd65a', lineColor: '#3f9a57', secondaryColor: '#0c1a10', tertiaryColor: '#0b120d', noteBkgColor: '#13261a', noteTextColor: '#86efa0', actorBkg: '#0f1f13', actorBorder: '#2bd65a', signalColor: '#3f9a57', signalTextColor: '#86efa0', edgeLabelBackground: '#0b120d', clusterBkg: '#0b150e', clusterBorder: '#1f5a30' }
}

export default function Mermaid({ code, streaming }: { code: string; streaming?: boolean }) {
  const id = 'm' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const theme = useApp((s) => resolveTheme(s.settings?.theme ?? 'dark'))
  const [svg, setSvg] = useState('')
  const [err, setErr] = useState('')
  const [zoom, setZoom] = useState(false)

  useEffect(() => {
    if (streaming) return
    let dead = false
    load().then(async (mermaid) => {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base', themeVariables: { ...VARS[theme], fontFamily: theme === 'terminal' ? 'JetBrains Mono, monospace' : 'Inter Variable, Inter, sans-serif', fontSize: '14px' }, flowchart: { curve: 'basis', htmlLabels: false, useMaxWidth: false }, sequence: { mirrorActors: false, useMaxWidth: false }, state: { useMaxWidth: false } })
      try {
        await mermaid.parse(code)
        const r = await mermaid.render(id, code)
        if (!dead) { setSvg(r.svg); setErr('') }
      } catch (e: any) {
        document.getElementById('d' + id)?.remove()
        if (!dead) { setErr(String(e?.message ?? e).split('\n')[0]); setSvg('') }
      }
    })
    return () => { dead = true }
  }, [code, theme, streaming, id])

  if (streaming || (!svg && !err)) return <div className="skeleton my-4 h-40 w-full rounded-xl" aria-label="Diagramma chizilmoqda" />
  if (err) return (
    <div className="codeblock"><div className="border-b px-3 py-1.5 text-xs text-warn">Diagrammani chizib bo'lmadi — manba matni ko'rsatilmoqda</div><pre><code>{code}</code></pre></div>
  )
  return (
    <>
      <figure className="mermaid-box group relative my-5 flex overflow-x-auto rounded-xl border bg-panel/60 p-4 [justify-content:safe_center]">
        <div dangerouslySetInnerHTML={{ __html: svg }} />
        <Button variant="secondary" size="iconSm" className="no-print absolute right-2 top-2 opacity-0 transition group-hover:opacity-100 focus:opacity-100" onClick={() => setZoom(true)} aria-label="Diagrammani kattalashtirish"><Maximize2 size={14} /></Button>
      </figure>
      <Modal open={zoom} onOpenChange={setZoom} title="Diagramma" wide className="max-w-[94vw]">
        <div className="mermaid-box flex justify-center overflow-auto [&_svg]:!max-w-none [&_svg]:min-w-[900px]" dangerouslySetInnerHTML={{ __html: svg }} />
      </Modal>
    </>
  )
}
