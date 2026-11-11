import { useEffect, useState } from 'react'
import { Segmented } from '@/components/ui'
import SequencePlayer, { type SeqDef } from './SequencePlayer'

const b64url = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const enc = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)))

const flow = (app: string, host: string, cli: boolean): SeqDef => ({
  actors: [{ name: 'Foydalanuvchi', sub: 'brauzer', icon: '🧑' }, { name: app, sub: cli ? 'public client (CLI)' : 'confidential client', icon: '🐙' }, { name: 'Keycloak', sub: 'IdP · realm: infra', icon: '🔑' }],
  steps: [
    { from: 0, to: 1, label: `${app} ga kirish`, detail: `Foydalanuvchi ${host} ni ochadi va «Log in via Keycloak» ni bosadi. Ilovada hali sessiya yo'q.` },
    { from: 1, to: 1, label: 'state, nonce, PKCE yaratiladi', detail: 'Ilova uchta tasodifiy qiymat yaratadi: state (CSRF himoyasi — javob aynan shu so\'rovga tegishli ekanini tekshirish), nonce (ID tokenni qayta ishlatishdan himoya) va PKCE code_verifier. code_challenge = BASE64URL(SHA256(code_verifier)).', data: 'code_verifier  = dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk\ncode_challenge = E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM' },
    { from: 1, to: 0, label: '302 → /authorize', detail: 'Ilova brauzerni Keycloak ning authorization endpoint iga yo\'naltiradi. Bu "front-channel" — URL brauzer tarixi va loglarda ko\'rinadi, shuning uchun bu yerda hech qanday sir yo\'q.', data: `GET https://sso.infra.uz/realms/infra/protocol/openid-connect/auth\n  ?response_type=code\n  &client_id=${app.toLowerCase()}\n  &redirect_uri=https://${host}/auth/callback\n  &scope=openid profile email groups\n  &state=af0ifjsldkj&nonce=n-0S6_WzA2Mj\n  &code_challenge=E9Melhoa...&code_challenge_method=S256` },
    { from: 0, to: 2, label: 'Login sahifasi', detail: 'Keycloak client_id va redirect_uri ni tekshiradi: redirect_uri client sozlamalaridagi "Valid redirect URIs" ga AYNAN mos kelishi shart, aks holda "Invalid redirect_uri". Bu kodni begona saytga yo\'naltirishdan himoya.' },
    { from: 0, to: 2, label: 'Login + parol (+ OTP)', detail: 'Foydalanuvchi parolini FAQAT Keycloak ga kiritadi. Ilova parolni hech qachon ko\'rmaydi — OIDC ning asosiy g\'oyasi shu. Keycloak SSO sessiya cookie sini o\'rnatadi (keyingi ilovalarda qayta login so\'ralmaydi).' },
    { from: 2, to: 0, label: '302 → redirect_uri?code=…', detail: 'Keycloak bir martalik, qisqa muddatli (≈60 s) authorization code beradi. Nega token emas? Chunki bu hali front-channel: URL dagi tokenni o\'g\'irlash oson. Code esa yolg\'iz o\'zi befoyda.', data: `HTTP/1.1 302 Found\nLocation: https://${host}/auth/callback\n  ?code=SplxlOBeZQQYbYS6WxSbIA\n  &state=af0ifjsldkj`, color: 'hsl(var(--warn))' },
    { from: 0, to: 1, label: 'Callback: code + state', detail: 'Brauzer code ni ilovaga olib keladi. Ilova state ni o\'zi yuborgan qiymat bilan solishtiradi — mos kelmasa so\'rov rad etiladi (CSRF hujumi).' },
    { from: 1, to: 2, label: 'POST /token (back-channel)', detail: `Ilova serveri to'g'ridan-to'g'ri Keycloak ga murojaat qiladi — brauzer ishtirok etmaydi. ${cli ? 'Public client da sir yo\'q, shuning uchun PKCE yagona himoya:' : 'Client o\'zini client_secret bilan tanitadi va'} code_verifier yuboriladi. Keycloak SHA256(code_verifier) == code_challenge ekanini tekshiradi: code ni o\'g\'irlagan hujumchi verifier ni bilmaydi.`, data: `POST /realms/infra/protocol/openid-connect/token\ngrant_type=authorization_code\n&code=SplxlOBeZQQYbYS6WxSbIA\n&redirect_uri=https://${host}/auth/callback\n&client_id=${app.toLowerCase()}${cli ? '' : '\n&client_secret=••••••••'}\n&code_verifier=dBjftJeZ4CVP...`, color: 'hsl(var(--info))' },
    { from: 2, to: 1, label: 'ID token + access token', detail: 'Keycloak uchta token qaytaradi. ID token — "foydalanuvchi kim" (ilova uchun). Access token — "nimaga ruxsat" (API uchun). Refresh token — yangi access token olish uchun.', data: '{\n  "id_token": "eyJhbGciOiJSUzI1NiIs...",\n  "access_token": "eyJhbGciOiJSUzI1NiIs...",\n  "refresh_token": "eyJhbGciOiJIUzUxMiIs...",\n  "expires_in": 300, "token_type": "Bearer"\n}', color: 'hsl(var(--ok))' },
    { from: 1, to: 2, label: 'GET /certs (JWKS)', detail: 'Ilova Keycloak ning ochiq kalitlarini oladi (keshlanadi). ID token imzosi shu kalit bilan tekshiriladi. Manzil discovery hujjatida: /.well-known/openid-configuration → jwks_uri.' },
    { from: 1, to: 1, label: 'Token tekshiruvi', detail: 'Ilova tekshiradi: (1) imzo JWKS dagi kalit bilan to\'g\'ri, (2) iss == Keycloak realm URL, (3) aud ichida o\'z client_id si, (4) exp o\'tmagan, (5) nonce o\'zi yuborganiga teng. Birortasi xato bo\'lsa — rad.', data: 'iss: https://sso.infra.uz/realms/infra  ✓\naud: ' + app.toLowerCase() + '  ✓\nexp: 1767225900 (5 daqiqa)  ✓\nnonce: n-0S6_WzA2Mj  ✓' },
    { from: 1, to: 1, label: 'groups → rol', detail: app === 'ArgoCD' ? 'ArgoCD "groups" claim ini o\'qiydi va argocd-rbac-cm dagi policy.csv bo\'yicha rolga bog\'laydi. groups claim kelishi uchun Keycloak da "Group Membership" mapper va scopes: \'[groups]\' kerak.' : 'Ilova groups claim asosida foydalanuvchiga ichki rol beradi.', data: 'g, /platform-admins, role:admin\ng, /developers, role:readonly\np, role:readonly, applications, get, */*, allow' },
    { from: 1, to: 0, label: 'Sessiya cookie → kirildi ✓', detail: 'Ilova o\'z sessiyasini yaratadi. Access token muddati tugaganda refresh token bilan yangilanadi — foydalanuvchi sezmaydi.', color: 'hsl(var(--ok))' }
  ]
})

function JwtBox() {
  const header = { alg: 'RS256', typ: 'JWT', kid: 'Qm3x…' }
  const [payload, setPayload] = useState(JSON.stringify({ iss: 'https://sso.infra.uz/realms/infra', sub: '8f1c2d3e-…', aud: 'argocd', exp: 1767225900, iat: 1767225600, nonce: 'n-0S6_WzA2Mj', preferred_username: 'jasur', email: 'jasur@infra.uz', groups: ['/platform-admins', '/developers'] }, null, 2))
  const [verifier, setVerifier] = useState('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')
  const [challenge, setChallenge] = useState('')
  useEffect(() => { crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)).then((d) => setChallenge(b64url(d))) }, [verifier])
  let p = '', err = ''
  try { p = enc(JSON.parse(payload)) } catch { err = 'JSON xato' }
  return (
    <div className="grid gap-5 @4xl:grid-cols-2">
      <div className="card p-5">
        <h3 className="mb-1 text-[15px] font-semibold">JWT anatomiyasi</h3>
        <p className="mb-3 text-[13px] leading-relaxed text-muted">JWT = <span className="text-bad">header</span>.<span className="text-accent">payload</span>.<span className="text-info">signature</span> — har biri base64url. Payload ni o'zgartirib ko'ring: token o'zgaradi, lekin imzo endi mos kelmaydi. <b>JWT shifrlanmagan</b> — uni har kim o'qiy oladi, faqat o'zgartira olmaydi.</p>
        <textarea value={payload} onChange={(e) => setPayload(e.target.value)} rows={12} className="input resize-none font-mono text-[12px]" aria-label="JWT payload" spellCheck={false} />
        {err && <p className="mt-1 text-xs text-bad">{err}</p>}
        <div className="mt-3 break-all rounded-lg border bg-bg p-3 font-mono text-[11.5px] leading-relaxed"><span className="text-bad">{enc(header)}</span>.<span className="text-accent">{p}</span>.<span className="text-info">SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c…</span></div>
      </div>
      <div className="card p-5">
        <h3 className="mb-1 text-[15px] font-semibold">PKCE hisoblagichi</h3>
        <p className="mb-3 text-[13px] leading-relaxed text-muted">code_challenge = BASE64URL(SHA-256(code_verifier)). Hujumchi challenge ni va code ni ko'rsa ham, hash dan verifier ni tiklay olmaydi.</p>
        <label className="text-xs text-faint" htmlFor="ver">code_verifier (43–128 belgi, maxfiy — faqat ilovada)</label>
        <input id="ver" value={verifier} onChange={(e) => setVerifier(e.target.value)} className="input mb-3 mt-1 font-mono text-[12px]" spellCheck={false} />
        <div className="text-xs text-faint">code_challenge (ochiq — /authorize ga yuboriladi)</div>
        <div className="mt-1 break-all rounded-lg border bg-bg p-3 font-mono text-[12px] text-ok">{challenge}</div>
        <table className="mt-5 w-full text-[12.5px]"><tbody className="divide-y">{[['iss', 'Tokenni kim bergan (issuer URL)'], ['sub', 'Foydalanuvchining o\'zgarmas ID si'], ['aud', 'Token kim uchun (client_id)'], ['exp / iat', 'Tugash / berilgan vaqt (Unix)'], ['nonce', 'Replay himoyasi'], ['groups', 'Guruhlar — RBAC uchun (mapper kerak)']].map(([k, v]) => <tr key={k}><td className="py-1.5 pr-3 font-mono text-accent">{k}</td><td className="py-1.5 text-muted">{v}</td></tr>)}</tbody></table>
      </div>
    </div>
  )
}

export default function Oidc() {
  const [tab, setTab] = useState<'argocd' | 'cli' | 'jwt'>('argocd')
  return (
    <div className="space-y-5">
      <Segmented label="Ssenariy" value={tab} onChange={setTab} options={[{ value: 'argocd', label: 'ArgoCD veb (code + PKCE)' }, { value: 'cli', label: 'argocd CLI (public client)' }, { value: 'jwt', label: 'JWT va PKCE' }]} />
      {tab === 'jwt' ? <JwtBox /> : <SequencePlayer def={flow('ArgoCD', tab === 'cli' ? 'localhost:8085' : 'argocd.infra.uz', tab === 'cli')} height={52} />}
    </div>
  )
}
