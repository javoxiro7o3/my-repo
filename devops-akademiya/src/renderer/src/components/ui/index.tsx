// shadcn/ui uslubidagi asosiy komponentlar (Radix + Tailwind + cva)
import * as React from 'react'
import * as DialogP from '@radix-ui/react-dialog'
import * as TooltipP from '@radix-ui/react-tooltip'
import * as SwitchP from '@radix-ui/react-switch'
import * as TabsP from '@radix-ui/react-tabs'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-45 active:scale-[.98]',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-fg shadow-soft hover:brightness-110',
        secondary: 'border bg-elev text-fg hover:bg-border/60',
        ghost: 'text-muted hover:bg-elev hover:text-fg',
        outline: 'border text-fg hover:bg-elev',
        danger: 'bg-bad/15 text-bad border border-bad/30 hover:bg-bad/25',
        ok: 'bg-ok/15 text-ok border border-ok/30 hover:bg-ok/25'
      },
      size: { sm: 'h-8 px-2.5 text-[13px]', md: 'h-9 px-3.5', lg: 'h-11 px-5 text-[15px]', icon: 'h-8 w-8', iconSm: 'h-7 w-7 rounded-md' }
    },
    defaultVariants: { variant: 'secondary', size: 'md' }
  }
)
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, type = 'button', ...p }, ref) => (
  <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...p} />
))
Button.displayName = 'Button'

export const TooltipProvider = TooltipP.Provider
export function Tip({ children, label, side = 'bottom', wide }: { children: React.ReactNode; label: React.ReactNode; side?: 'top' | 'bottom' | 'left' | 'right'; wide?: boolean }) {
  return (
    <TooltipP.Root>
      <TooltipP.Trigger asChild>{children}</TooltipP.Trigger>
      <TooltipP.Portal>
        <TooltipP.Content side={side} sideOffset={6} className={cn('z-[100] rounded-lg border bg-elev px-2.5 py-1.5 text-xs text-fg shadow-soft animate-in fade-in-0 zoom-in-95', wide ? 'max-w-xs leading-relaxed' : 'max-w-[240px]')}>
          {label}
        </TooltipP.Content>
      </TooltipP.Portal>
    </TooltipP.Root>
  )
}

export function Modal({ open, onOpenChange, title, desc, children, wide, className }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; desc?: string; children: React.ReactNode; wide?: boolean; className?: string }) {
  return (
    <DialogP.Root open={open} onOpenChange={onOpenChange}>
      <DialogP.Portal>
        <DialogP.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogP.Content className={cn('fixed left-1/2 top-1/2 z-50 max-h-[86vh] w-[92vw] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-panel p-6 shadow-soft data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95', wide ? 'max-w-5xl' : 'max-w-lg', className)}>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <DialogP.Title className="text-lg font-semibold tracking-tight">{title}</DialogP.Title>
              {desc ? <DialogP.Description className="mt-1 text-sm text-muted">{desc}</DialogP.Description> : <DialogP.Description className="sr-only">{title}</DialogP.Description>}
            </div>
            <DialogP.Close asChild><Button variant="ghost" size="iconSm" aria-label="Yopish"><X size={16} /></Button></DialogP.Close>
          </div>
          {children}
        </DialogP.Content>
      </DialogP.Portal>
    </DialogP.Root>
  )
}

export function Switch({ checked, onCheckedChange, label }: { checked: boolean; onCheckedChange: (v: boolean) => void; label: string }) {
  return (
    <SwitchP.Root checked={checked} onCheckedChange={onCheckedChange} aria-label={label} className="relative h-5 w-9 shrink-0 rounded-full bg-border transition-colors data-[state=checked]:bg-accent">
      <SwitchP.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
    </SwitchP.Root>
  )
}

export const Tabs = TabsP.Root
export const TabsList = ({ className, ...p }: TabsP.TabsListProps) => <TabsP.List className={cn('inline-flex gap-1 rounded-lg border bg-elev p-1', className)} {...p} />
export const TabsTrigger = ({ className, ...p }: TabsP.TabsTriggerProps) => <TabsP.Trigger className={cn('rounded-md px-3 py-1.5 text-[13px] font-medium text-muted transition data-[state=active]:bg-panel data-[state=active]:text-fg data-[state=active]:shadow-soft hover:text-fg', className)} {...p} />
export const TabsContent = TabsP.Content

export function Ring({ value, size = 28, stroke = 3, children, color }: { value: number; size?: number; stroke?: number; children?: React.ReactNode; color?: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color ?? 'hsl(var(--accent))'} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, value))} style={{ transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      {children ? <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold">{children}</span> : null}
    </span>
  )
}

export const Kbd = ({ children }: { children: React.ReactNode }) => <kbd className="rounded-md border bg-elev px-1.5 py-0.5 font-mono text-[11px] text-muted shadow-[0_1px_0_hsl(var(--border))]">{children}</kbd>

export function Empty({ icon, title, desc, action }: { icon: React.ReactNode; title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-2xl text-accent">{icon}</div>
      <div className="text-[15px] font-semibold">{title}</div>
      {desc ? <p className="max-w-md text-sm leading-relaxed text-muted">{desc}</p> : null}
      {action}
    </div>
  )
}

export const Skeleton = ({ className }: { className?: string }) => <div className={cn('skeleton h-4', className)} />
export function SkeletonText({ lines = 6 }: { lines?: number }) {
  return <div className="space-y-3" aria-busy="true" aria-label="Yuklanmoqda">{Array.from({ length: lines }, (_, i) => <Skeleton key={i} className={i % 4 === 3 ? 'w-2/5' : i % 3 === 1 ? 'w-11/12' : 'w-full'} />)}</div>
}

export function PageHeader({ title, desc, right, icon }: { title: string; desc?: string; right?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-3">
        {icon ? <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/12 text-accent">{icon}</div> : null}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {desc ? <p className="mt-0.5 text-sm text-muted">{desc}</p> : null}
        </div>
      </div>
      {right}
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-1 rounded-lg border bg-elev p-1">
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)} className={cn('rounded-md px-3 py-1 text-[13px] font-medium transition', value === o.value ? 'bg-panel text-fg shadow-soft' : 'text-muted hover:text-fg')}>{o.label}</button>
      ))}
    </div>
  )
}
