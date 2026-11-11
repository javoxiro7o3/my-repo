import { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Segmented } from '@/components/ui'
import SequencePlayer, { type SeqDef } from './SequencePlayer'

interface Comp { id: string; name: string; x: number; y: number; w: number; h: number; zone: 'cp' | 'node' | 'ext'; what: string; how: string; fail: string; cmd: string; port?: string }
const COMPS: Comp[] = [
  { id: 'kubectl', name: 'kubectl', x: 20, y: 150, w: 110, h: 46, zone: 'ext', what: 'Buyruq qatori mijozi. YAML ni JSON ga aylantirib, API serverga HTTPS so\'rov yuboradi.', how: '~/.kube/config dan klaster manzili va sertifikat/tokenni oladi. "kubectl apply" — server-side yoki client-side 3-way merge (last-applied annotatsiya).', fail: 'kubectl ishlamasa ham klaster ishlayveradi — bu shunchaki mijoz.', cmd: 'kubectl get pods -v=8   # HTTP so\'rovlarni ko\'rsatadi' },
  { id: 'api', name: 'kube-apiserver', x: 190, y: 60, w: 170, h: 56, zone: 'cp', port: '6443', what: 'Klasterning YAGONA kirish eshigi. Barcha komponentlar faqat u orqali gaplashadi; etcd ga faqat u yozadi.', how: 'Har so\'rov: Authentication (kim?) → Authorization/RBAC (mumkinmi?) → Admission (mutating → validating webhook) → sxema validatsiyasi → etcd. Holatsiz (stateless) — bir nechta nusxada ishlaydi. Watch orqali o\'zgarishlarni mijozlarga oqim qilib yuboradi.', fail: 'O\'chsa: kubectl va controller lar ishlamaydi, yangi Pod yaratilmaydi. Lekin ishlab turgan Pod lar ishlayveradi (kubelet oxirgi ma\'lum holatni ushlaydi).', cmd: 'kubectl get --raw /readyz?verbose' },
  { id: 'etcd', name: 'etcd', x: 430, y: 60, w: 110, h: 56, zone: 'cp', port: '2379', what: 'Taqsimlangan kalit-qiymat bazasi: klasterning butun holati (barcha obyektlar) shu yerda.', how: 'Raft konsensus: yozuv ko\'pchilik (quorum) tasdiqlagach commit bo\'ladi. 3 node → 1, 5 node → 2 nosozlikka chidaydi. Kalitlar: /registry/pods/<ns>/<nom>. Har o\'zgarishda revision oshadi — watch shunga tayanadi.', fail: 'Quorum yo\'qolsa klaster "faqat o\'qish"ga tushadi. Zaxirasiz yo\'qolsa — klaster holati butunlay yo\'qoladi. Shuning uchun snapshot majburiy.', cmd: 'etcdctl snapshot save /backup/etcd.db' },
  { id: 'sched', name: 'kube-scheduler', x: 190, y: 160, w: 170, h: 50, zone: 'cp', what: 'nodeName bo\'sh Pod larni kuzatadi va har biriga eng mos node ni tanlaydi.', how: 'Ikki bosqich: Filter (resurs yetadimi? taint? affinity? port bandmi?) → Score (qolganlarini baholash: resurs muvozanati, image bormi, spread). So\'ng Binding obyekti orqali Pod ga nodeName yozadi. O\'zi hech narsani ishga tushirmaydi!', fail: 'O\'chsa: yangi Pod lar Pending da qoladi; mavjudlari ishlayveradi.', cmd: 'kubectl get events --field-selector reason=FailedScheduling' },
  { id: 'cm', name: 'controller-manager', x: 190, y: 250, w: 170, h: 50, zone: 'cp', what: 'O\'nlab nazorat sikllari (Deployment, ReplicaSet, Node, Job, EndpointSlice...) bitta jarayonda.', how: 'Har controller: kuzat (watch) → xohlangan va haqiqiy holatni solishtir → farqni yo\'qot. Masalan ReplicaSet controller: replicas=3, bor 2 → 1 ta Pod yaratadi. Level-triggered: hodisani o\'tkazib yuborsa ham keyingi siklda tuzatadi.', fail: 'O\'chsa: o\'z-o\'zini tiklash to\'xtaydi — o\'lgan Pod o\'rniga yangisi yaratilmaydi, rollout davom etmaydi.', cmd: 'kubectl -n kube-system logs kube-controller-manager-<node>' },
  { id: 'kubelet', name: 'kubelet', x: 470, y: 200, w: 120, h: 50, zone: 'node', port: '10250', what: 'Har node dagi agent. O\'z node iga biriktirilgan Pod larni kuzatadi va ularni haqiqatga aylantiradi.', how: 'PodSpec → CRI orqali runtime ga: sandbox (pause konteyner + tarmoq namespace) yaratish → CNI ni chaqirish → image tortish → konteynerlarni ishga tushirish. Probe larni bajaradi, holatni API ga yozadi, node Lease ni yangilaydi.', fail: 'O\'chsa: node NotReady; ~5 daqiqadan keyin Pod lar boshqa node larda qayta yaratiladi. Konteynerlarning o\'zi esa ishlashda davom etadi.', cmd: 'journalctl -u kubelet -f' },
  { id: 'cri', name: 'containerd (CRI)', x: 620, y: 200, w: 150, h: 50, zone: 'node', what: 'Konteyner runtime: image larni tortadi, konteynerlarni runc orqali ishga tushiradi.', how: 'kubelet ↔ containerd: gRPC (CRI). containerd → containerd-shim → runc → namespaces + cgroups. Docker Engine 1.24 dan beri to\'g\'ridan-to\'g\'ri qo\'llanmaydi (dockershim olib tashlangan).', fail: 'O\'chsa: yangi konteyner ishga tushmaydi; shim tufayli mavjudlari tirik qoladi.', cmd: 'crictl ps && crictl logs <id>' },
  { id: 'proxy', name: 'kube-proxy', x: 470, y: 280, w: 120, h: 50, zone: 'node', what: 'Service virtual IP larini amalga oshiradi.', how: 'Service va EndpointSlice larni kuzatib, node da iptables/IPVS/nftables qoidalarini yozadi: ClusterIP ga kelgan paket tasodifiy Pod IP siga DNAT qilinadi. Trafik uning o\'zidan o\'tmaydi — u faqat qoidalarni yozadi.', fail: 'O\'chsa: mavjud qoidalar ishlayveradi, lekin yangi Service/Pod o\'zgarishlari aks etmaydi.', cmd: 'iptables-save | grep KUBE-SVC' },
  { id: 'cni', name: 'CNI plagin', x: 620, y: 280, w: 150, h: 50, zone: 'node', what: 'Pod ga IP beradi va Pod lararo tarmoqni quradi (Calico, Cilium, Flannel).', how: 'kubelet Pod sandbox yaratganda CNI binarini chaqiradi: veth juftlik yaratiladi, biri Pod namespace iga, IP IPAM dan. Node lararo: VXLAN/IP-in-IP overlay yoki BGP marshrutlar. NetworkPolicy ni ham CNI amalga oshiradi.', fail: 'CNI yo\'q bo\'lsa node NotReady, Pod lar ContainerCreating da qoladi.', cmd: 'ls /etc/cni/net.d/ && kubectl -n kube-system get pods' },
  { id: 'pod', name: 'Pod', x: 545, y: 360, w: 150, h: 48, zone: 'node', what: 'Eng kichik chiqarish birligi: umumiy tarmoq namespace li bir yoki bir necha konteyner.', how: 'pause konteyner namespace larni ushlab turadi; ilova konteynerlari unga qo\'shiladi. Shuning uchun Pod ichida localhost umumiy, IP bitta.', fail: 'Pod o\'tkinchi: o\'lsa qayta tirilmaydi — controller yangisini (yangi IP bilan) yaratadi.', cmd: 'kubectl describe pod <nom>' },
  { id: 'dns', name: 'CoreDNS', x: 190, y: 340, w: 170, h: 46, zone: 'cp', port: '53', what: 'Klaster ichki DNS: Service nomlarini ClusterIP ga aylantiradi.', how: 'Deployment sifatida ishlaydi (kube-system). API dan Service larni kuzatadi. Pod ning /etc/resolv.conf: nameserver 10.96.0.10, search <ns>.svc.cluster.local ..., ndots:5.', fail: 'O\'chsa: nom bo\'yicha murojaatlar ishlamaydi (IP bo\'yicha ishlaydi) — eng ko\'p uchraydigan "sirli" nosozliklardan.', cmd: 'kubectl run -it --rm dbg --image=busybox:1.36 -- nslookup kubernetes.default' }
]
const LINKS: [string, string, boolean?][] = [['kubectl', 'api'], ['api', 'etcd'], ['sched', 'api'], ['cm', 'api'], ['kubelet', 'api'], ['proxy', 'api'], ['kubelet', 'cri'], ['kubelet', 'cni', true], ['cri', 'pod'], ['dns', 'api']]

const APPLY: SeqDef = {
  actors: [{ name: 'kubectl', icon: '⌨️' }, { name: 'apiserver', icon: '🚪' }, { name: 'etcd', icon: '🗄️' }, { name: 'controllers', sub: 'Deployment + RS', icon: '🔁' }, { name: 'scheduler', icon: '🎯' }, { name: 'kubelet', sub: '+ containerd', icon: '⚙️' }],
  steps: [
    { from: 0, to: 1, label: 'POST Deployment', detail: 'kubectl apply -f deploy.yaml: YAML → JSON, kubeconfig dagi sertifikat bilan HTTPS so\'rov.', data: 'POST /apis/apps/v1/namespaces/default/deployments\n{ "kind": "Deployment", "spec": { "replicas": 3, ... } }' },
    { from: 1, to: 1, label: 'AuthN → AuthZ → Admission', detail: 'Kim? (x509/token) → RBAC ruxsat beradimi (create deployments)? → mutating webhook lar (default qiymatlar, sidecar) → validating webhook lar → sxema tekshiruvi. Bittasi rad etsa — 4xx.' },
    { from: 1, to: 2, label: 'Yozish (Raft)', detail: 'Obyekt etcd ga yoziladi; ko\'pchilik tasdiqlagach commit. Shundan keyingina kubectl ga "created" qaytadi. Shu paytgacha hech qanday konteyner yo\'q — faqat "xohish" yozildi.', data: '/registry/deployments/default/web' },
    { from: 1, to: 3, label: 'watch: yangi Deployment', detail: 'Deployment controller watch orqali hodisani oladi. Farq: ReplicaSet yo\'q → pod-template-hash bilan ReplicaSet yaratadi (API orqali).', data: 'ReplicaSet web-7d4b9c6f5 (replicas: 3)' },
    { from: 3, to: 1, label: 'ReplicaSet → 3 ta Pod', detail: 'ReplicaSet controller: xohlangan 3, bor 0 → 3 ta Pod obyekti yaratadi. Ularda nodeName BO\'SH, holati Pending.', data: 'Pod web-7d4b9c6f5-x2k9p  nodeName: ""  phase: Pending' },
    { from: 1, to: 4, label: 'watch: nodeName bo\'sh Pod', detail: 'Scheduler rejalashtirilmagan Pod larni ko\'radi. Filter: qaysi node larga sig\'adi (requests, taint, affinity)? Score: eng yaxshisi qaysi?' },
    { from: 4, to: 1, label: 'Binding: nodeName = node-2', detail: 'Scheduler faqat qaror yozadi — Pod ga node ni biriktiradi. O\'zi hech narsa ishga tushirmaydi.', data: 'POST .../pods/web-...-x2k9p/binding\n{ "target": { "name": "node-2" } }' },
    { from: 1, to: 5, label: 'watch: menga Pod biriktirildi', detail: 'node-2 dagi kubelet o\'z node iga tegishli Pod ni ko\'radi.' },
    { from: 5, to: 5, label: 'Sandbox + CNI + image + start', detail: 'CRI orqali: (1) pause konteyner — tarmoq namespace; (2) CNI: veth + IP; (3) image pull; (4) konteynerlar ishga tushadi; (5) startup/readiness probe lar boshlanadi.', data: 'Events:\n  Scheduled → Pulling → Pulled → Created → Started' },
    { from: 5, to: 1, label: 'Status: Running, Ready', detail: 'kubelet Pod statusini (IP, holat, Ready) API ga yozadi. EndpointSlice controller Ready Pod ni Service ortiga qo\'shadi — endi trafik keladi.', data: 'status: { phase: Running, podIP: 10.244.2.17,\n  conditions: [{ type: Ready, status: "True" }] }', color: 'hsl(var(--ok))' }
  ]
}

export default function K8sMap() {
  const [tab, setTab] = useState<'map' | 'flow'>('map')
  const [sel, setSel] = useState('api')
  const c = COMPS.find((x) => x.id === sel)!
  const mid = (k: Comp) => ({ x: k.x + k.w / 2, y: k.y + k.h / 2 })
  return (
    <div className="space-y-5">
      <Segmented label="Ko'rinish" value={tab} onChange={setTab} options={[{ value: 'map', label: 'Arxitektura xaritasi' }, { value: 'flow', label: '"kubectl apply" → Pod oqimi' }]} />
      {tab === 'flow' ? <SequencePlayer def={APPLY} height={50} /> : (
        <div className="grid gap-5 @5xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="card p-2">
            <svg viewBox="0 0 800 430" className="w-full" role="img" aria-label="Kubernetes arxitekturasi">
              <rect x="170" y="20" width="390" height="385" rx="16" fill="hsl(var(--accent) / .05)" stroke="hsl(var(--accent) / .4)" strokeDasharray="6 5" /><text x="186" y="42" fontSize="12" fontWeight="700" fill="hsl(var(--accent))">CONTROL PLANE</text>
              <rect x="450" y="160" width="335" height="262" rx="16" fill="hsl(var(--ok) / .06)" stroke="hsl(var(--ok) / .45)" strokeDasharray="6 5" /><text x="640" y="182" fontSize="12" fontWeight="700" fill="hsl(var(--ok))">WORKER NODE (× N)</text>
              {LINKS.map(([a, b, dashed]) => { const A = mid(COMPS.find((x) => x.id === a)!), B = mid(COMPS.find((x) => x.id === b)!); const act = sel === a || sel === b; return <line key={a + b} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={act ? 'hsl(var(--accent))' : 'hsl(var(--border))'} strokeWidth={act ? 2.5 : 1.5} strokeDasharray={dashed ? '4 4' : ''} /> })}
              {COMPS.map((k) => (
                <motion.g key={k.id} onClick={() => setSel(k.id)} whileHover={{ scale: 1.04 }} style={{ transformOrigin: `${k.x + k.w / 2}px ${k.y + k.h / 2}px` }} className="cursor-pointer" role="button" tabIndex={0} aria-label={k.name} aria-pressed={sel === k.id} onKeyDown={(e) => e.key === 'Enter' && setSel(k.id)}>
                  <rect x={k.x} y={k.y} width={k.w} height={k.h} rx={11} fill={sel === k.id ? 'hsl(var(--accent) / .25)' : 'hsl(var(--panel))'} stroke={sel === k.id ? 'hsl(var(--accent))' : 'hsl(var(--border))'} strokeWidth={sel === k.id ? 2.5 : 1.5} />
                  <text x={k.x + k.w / 2} y={k.y + k.h / 2 + (k.port ? -1 : 4.5)} textAnchor="middle" fontSize="13" fontWeight="650" fill="hsl(var(--fg))">{k.name}</text>
                  {k.port && <text x={k.x + k.w / 2} y={k.y + k.h / 2 + 14} textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono" fill="hsl(var(--faint))">:{k.port}</text>}
                </motion.g>
              ))}
              <text x="75" y="215" textAnchor="middle" fontSize="10.5" fill="hsl(var(--faint))">siz</text>
            </svg>
            <p className="px-3 pb-2 text-xs text-faint">Komponentni bosing. E'tibor bering: barcha chiziqlar API serverga boradi — komponentlar bir-biri bilan to'g'ridan-to'g'ri gaplashmaydi.</p>
          </div>
          <motion.div key={c.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="card space-y-4 p-5">
            <div><span className={cn('chip', c.zone === 'cp' ? '!border-accent/50 !text-accent' : c.zone === 'node' ? '!border-ok/50 !text-ok' : '')}>{c.zone === 'cp' ? 'control plane' : c.zone === 'node' ? 'har node da' : 'mijoz'}</span><h3 className="mt-2 text-xl font-semibold tracking-tight">{c.name}</h3></div>
            <div><div className="label mb-1">Nima qiladi</div><p className="text-[13.5px] leading-relaxed">{c.what}</p></div>
            <div><div className="label mb-1">Ichida qanday ishlaydi</div><p className="text-[13.5px] leading-relaxed text-muted">{c.how}</p></div>
            <div className="rounded-lg border border-bad/30 bg-bad/[.07] px-3 py-2"><div className="label mb-1 !text-bad">Ishdan chiqsa</div><p className="text-[13px] leading-relaxed">{c.fail}</p></div>
            <div><div className="label mb-1">Tekshirish</div><code className="block overflow-x-auto whitespace-pre rounded-lg border bg-bg px-3 py-2 font-mono text-[12px]">{c.cmd}</code></div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
