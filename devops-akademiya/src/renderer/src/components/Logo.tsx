export default function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" aria-hidden="true">
      <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6366f1" /><stop offset="1" stopColor="#22d3ee" /></linearGradient></defs>
      <rect x="6" y="6" width="116" height="116" rx="30" fill="#12152a" stroke="url(#lg)" strokeWidth="4" />
      <path d="M34 64c0-11 8-18 17-18 13 0 17 36 30 36 9 0 17-7 17-18s-8-18-17-18c-13 0-17 36-30 36-9 0-17-7-17-18z" fill="none" stroke="url(#lg)" strokeWidth="10" strokeLinecap="round" />
    </svg>
  )
}
