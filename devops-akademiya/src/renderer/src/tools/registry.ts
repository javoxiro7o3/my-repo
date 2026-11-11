import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

export interface ToolDef { id: string; title: string; desc: string; icon: string; group: string; tags: string; component: LazyExoticComponent<ComponentType> }

export const TOOLS: ToolDef[] = [
  { id: 'terminal', group: 'Linux', icon: '🖥️', title: 'Linux terminal sandbox', desc: 'Xavfsiz virtual fayl tizimida buyruqlarni mashq qiling — topshiriqlar va avtomatik tekshiruv bilan', tags: 'bash shell ls grep chmod find', component: lazy(() => import('./Terminal')) },
  { id: 'perms', group: 'Linux', icon: '🔐', title: 'Ruxsatlar va cron', desc: 'chmod 755 ↔ rwx kalkulyatori, umask, maxsus bitlar va cron ifoda tuzuvchi', tags: 'chmod umask suid cron crontab', component: lazy(() => import('./Perms')) },
  { id: 'git', group: 'Linux', icon: '🌿', title: 'Git vizualizatori', desc: 'Commit grafi: branch, merge va rebase farqini jonli ko\'ring', tags: 'git commit branch merge rebase', component: lazy(() => import('./GitViz')) },
  { id: 'subnet', group: 'Tarmoq', icon: '🧮', title: 'Subnet / CIDR kalkulyator', desc: 'IPv4/IPv6, bit-xarita, bo\'lish va VLSM mashqlari', tags: 'ip cidr mask vlsm ipv6', component: lazy(() => import('./Subnet')) },
  { id: 'osi', group: 'Tarmoq', icon: '📦', title: 'OSI, TCP va TLS animatsiyasi', desc: 'Inkapsulyatsiya qatlamma-qatlam; TCP 3-way, TLS 1.3 va DHCP DORA handshake', tags: 'osi tcp tls handshake dhcp encapsulation', component: lazy(() => import('./Osi')) },
  { id: 'nat', group: 'Tarmoq', icon: '🔀', title: 'Routing / NAT simulyatori', desc: 'Paket yo\'li, routing qarori, SNAT/DNAT va conntrack jadvali', tags: 'routing nat snat dnat iptables conntrack', component: lazy(() => import('./Nat')) },
  { id: 'layers', group: 'Docker', icon: '🥞', title: 'Docker layer / cache vizualizatori', desc: 'Dockerfile tartibi o\'zgarsa kesh qanday buzilishini ko\'ring', tags: 'docker dockerfile layer cache build', component: lazy(() => import('./Layers')) },
  { id: 'validator', group: 'Docker', icon: '✅', title: 'YAML / HCL / Dockerfile validator', desc: 'Sintaksis va best-practice tekshiruvi, "xatoni top" mashqlari', tags: 'yaml hcl dockerfile lint validate', component: lazy(() => import('./Validator')) },
  { id: 'raft', group: 'Taqsimlangan tizimlar', icon: '🗳️', title: 'Raft protokol vizualizatori', desc: 'Leader election, log replication; node o\'chirib, tarmoqni bo\'lib ko\'ring', tags: 'raft consensus leader quorum etcd', component: lazy(() => import('./Raft')) },
  { id: 'patroni', group: 'Taqsimlangan tizimlar', icon: '🐘', title: 'Patroni / HAProxy failover', desc: 'Primary o\'chirilsa nima bo\'ladi: leader key, promote, HAProxy yo\'naltirishi', tags: 'patroni postgres haproxy failover etcd', component: lazy(() => import('./Patroni')) },
  { id: 'k8smap', group: 'Kubernetes', icon: '☸️', title: 'Kubernetes arxitektura xaritasi', desc: 'Komponentlarni bosib o\'rganing; "kubectl apply" dan Pod gacha oqim animatsiyasi', tags: 'kubernetes apiserver etcd kubelet scheduler', component: lazy(() => import('./K8sMap')) },
  { id: 'scheduler', group: 'Kubernetes', icon: '🎯', title: 'Scheduler o\'yini', desc: 'requests, taint, affinity bilan Pod qaysi node ga tushishini toping', tags: 'scheduler affinity taint toleration requests', component: lazy(() => import('./Scheduler')) },
  { id: 'hpa', group: 'Kubernetes', icon: '📈', title: 'HPA / KEDA simulyatori', desc: 'Yuklama grafigi bo\'yicha replica soni; stabilizatsiya oynasi va scale-to-zero', tags: 'hpa keda autoscaling replicas', component: lazy(() => import('./Hpa')) },
  { id: 'promql', group: 'Observability', icon: '🔥', title: 'PromQL playground', desc: 'Namunaviy metrikalar ustida so\'rov yozing va grafigini ko\'ring', tags: 'promql prometheus rate histogram_quantile', component: lazy(() => import('./PromQL')) },
  { id: 'oidc', group: 'Xavfsizlik', icon: '🪪', title: 'OIDC / OAuth flow animatsiyasi', desc: 'Authorization code + PKCE oqimi Keycloak va ArgoCD misolida', tags: 'oidc oauth pkce keycloak jwt', component: lazy(() => import('./Oidc')) }
]
