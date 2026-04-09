import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  icon: ReactNode
  subtitle?: string
  className?: string
}

export function StatCard({ title, value, icon, subtitle, className }: StatCardProps) {
  return (
    <div className={cn('bg-card border border-border rounded-xl p-5', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        <div className="text-muted-foreground">{icon}</div>
      </div>
    </div>
  )
}
