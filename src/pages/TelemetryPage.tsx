import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { AlertTriangle, BookOpen, Library, Trash2, FileText, BarChart3 } from 'lucide-react'
import { useTelemetry } from '@/hooks/useGitHub'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ErrorMessage } from '@/components/ErrorMessage'
import { cn } from '@/lib/utils'
import type { AgentRunEntry } from '@/types'

// ─── Filter window ────────────────────────────────────────────────────────────

type Window = 7 | 30 | 90 | 'all'

const WINDOWS: { label: string; value: Window }[] = [
  { label: '7 дней',    value: 7   },
  { label: '30 дней',   value: 30  },
  { label: '90 дней',   value: 90  },
  { label: 'Всё время', value: 'all' },
]

function filterByWindow(entries: AgentRunEntry[], window: Window): AgentRunEntry[] {
  if (window === 'all') return entries
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - window)
  return entries.filter(e => {
    if (!e.ts) return false
    try { return new Date(e.ts) >= cutoff }
    catch { return false }
  })
}

// ─── Frequency counter ────────────────────────────────────────────────────────

function topN(items: string[], n: number): { label: string; count: number }[] {
  const freq: Record<string, number> = {}
  for (const item of items) {
    if (item) freq[item] = (freq[item] ?? 0) + 1
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, count]) => ({ label, count }))
}

// ─── Section card wrapper ─────────────────────────────────────────────────────

function SectionCard({
  title,
  icon,
  children,
  warning,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  warning?: string
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <span className="text-accent">{icon}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {warning && (
        <div className="px-5 py-3 bg-danger/10 border-b border-danger/20 flex items-center gap-2">
          <AlertTriangle size={14} className="text-danger shrink-0" />
          <p className="text-xs text-danger">{warning}</p>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

// ─── Volume chart ─────────────────────────────────────────────────────────────

function VolumeBlock({ entries }: { entries: AgentRunEntry[] }) {
  const agentCounts = useMemo(() => {
    const freq: Record<string, number> = {}
    for (const e of entries) {
      const agent = e.agent || 'unknown'
      freq[agent] = (freq[agent] ?? 0) + 1
    }
    return Object.entries(freq).map(([name, count]) => ({ name, count }))
  }, [entries])

  const COLORS = ['#7c3aed', '#2563eb', '#0891b2', '#059669', '#d97706']

  return (
    <SectionCard title="Объём вызовов" icon={<BarChart3 size={16} />}>
      <div className="text-3xl font-bold font-mono mb-4">{entries.length}</div>
      {agentCounts.length > 0 ? (
        <ResponsiveContainer width="100%" height={160}>
          <RechartsBarChart data={agentCounts} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: 'var(--color-muted-foreground, #888)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--color-muted-foreground, #888)' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--color-card, #1a1a2e)',
                border: '1px solid var(--color-border, #333)',
                borderRadius: 8,
                fontSize: 12,
              }}
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {agentCounts.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </RechartsBarChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-sm text-muted-foreground">Нет данных</p>
      )}
    </SectionCard>
  )
}

// ─── Compliance block ─────────────────────────────────────────────────────────

function ComplianceBlock({ entries }: { entries: AgentRunEntry[] }) {
  const { pct, missing, total } = useMemo(() => {
    const total = entries.length
    if (total === 0) return { pct: 100, missing: 0, total: 0 }
    const missing = entries.filter(e => e.missing_citations || !e.citations_ok).length
    const pct = Math.round((1 - missing / total) * 100)
    return { pct, missing, total }
  }, [entries])

  const isLow = pct < 80
  const barColor = isLow ? 'bg-danger' : 'bg-green-500'

  return (
    <SectionCard
      title="Соблюдение citations"
      icon={<FileText size={16} />}
      warning={isLow ? 'Промпты агентов игнорируются — citations < 80%' : undefined}
    >
      <div className="flex items-end gap-3 mb-4">
        <span className={cn('text-4xl font-bold font-mono', isLow ? 'text-danger' : 'text-green-400')}>
          {pct}%
        </span>
        <span className="text-sm text-muted-foreground mb-1">
          ({missing} из {total} без citations)
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </SectionCard>
  )
}

// ─── Top list component ───────────────────────────────────────────────────────

function TopList({
  items,
  linkPrefix,
  emptyText,
}: {
  items: { label: string; count: number }[]
  linkPrefix?: string
  emptyText: string
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>
  }
  const maxCount = items[0].count
  return (
    <ul className="space-y-2">
      {items.map(({ label, count }) => (
        <li key={label} className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            {linkPrefix ? (
              <Link
                to={linkPrefix}
                className="text-xs text-foreground hover:text-accent transition-colors truncate block"
                title={label}
              >
                {label}
              </Link>
            ) : (
              <span className="text-xs text-foreground truncate block" title={label}>{label}</span>
            )}
            <div className="h-1 bg-muted rounded-full mt-1 overflow-hidden">
              <div
                className="h-full bg-accent/50 rounded-full"
                style={{ width: `${Math.max((count / maxCount) * 100, 4)}%` }}
              />
            </div>
          </div>
          <span className="text-xs font-mono text-muted-foreground shrink-0">{count}x</span>
        </li>
      ))}
    </ul>
  )
}

// ─── Dead weight ──────────────────────────────────────────────────────────────

function DeadWeightBlock({ entries }: { entries: AgentRunEntry[] }) {
  const items = useMemo(() => {
    // Items read >= 2 times but NEVER used
    const readFreq: Record<string, number> = {}
    const usedSet = new Set<string>()

    for (const e of entries) {
      for (const item of [...(e.learnings_read ?? []), ...(e.library_read ?? [])]) {
        readFreq[item] = (readFreq[item] ?? 0) + 1
      }
      for (const item of [...(e.learnings_used ?? []), ...(e.library_used ?? [])]) {
        usedSet.add(item)
      }
    }

    return Object.entries(readFreq)
      .filter(([item, count]) => count >= 2 && !usedSet.has(item))
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, count }))
  }, [entries])

  return (
    <SectionCard title="Dead weight (читают, не используют)" icon={<Trash2 size={16} />}>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Нет кандидатов на удаление</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map(({ label, count }) => (
            <li key={label} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground truncate" title={label}>{label}</span>
              <span className="font-mono text-warning shrink-0">{count}x прочитан, 0x использован</span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

// ─── Notes digest ─────────────────────────────────────────────────────────────

function NotesDigest({ entries }: { entries: AgentRunEntry[] }) {
  const notes = useMemo(() =>
    entries
      .filter(e => e.notes && e.notes.trim())
      .map(e => ({ agent: e.agent, ts: e.ts, text: e.notes as string }))
      .reverse()
      .slice(0, 20),
  [entries])

  return (
    <SectionCard title="Заметки агентов" icon={<FileText size={16} />}>
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Заметок нет</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n, i) => (
            <li key={i} className="border-l-2 border-border pl-3">
              <p className="text-xs text-foreground leading-relaxed">{n.text}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {n.agent} · {n.ts ? new Date(n.ts).toLocaleDateString('ru') : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function TelemetryPage() {
  const { entries, loading, error, reload } = useTelemetry()
  const [window, setWindow] = useState<Window>(30)

  const filtered = useMemo(
    () => filterByWindow(entries, window),
    [entries, window],
  )

  const topLearnings = useMemo(
    () => topN(filtered.flatMap(e => e.learnings_used ?? []), 10),
    [filtered],
  )
  const topLibrary = useMemo(
    () => topN(filtered.flatMap(e => e.library_used ?? []), 10),
    [filtered],
  )

  if (loading) return <LoadingSpinner message="Загрузка телеметрии..." />
  if (error)   return <ErrorMessage message={error} onRetry={reload} />

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Телеметрия</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {entries.length} записей в agent_runs.jsonl
        </p>
      </div>

      {/* Window filter */}
      <div className="flex gap-2 mb-6">
        {WINDOWS.map(w => (
          <button
            key={w.value}
            onClick={() => setWindow(w.value)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg border transition-colors',
              window === w.value
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            {w.label}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground text-sm">
            Файл <code className="bg-muted px-1 py-0.5 rounded text-xs">system/telemetry/agent_runs.jsonl</code> не найден или пуст.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Row 1: Volume + Compliance */}
          <VolumeBlock entries={filtered} />
          <ComplianceBlock entries={filtered} />

          {/* Row 2: Top learnings */}
          <SectionCard title="Топ учений (learnings_used)" icon={<BookOpen size={16} />}>
            <TopList
              items={topLearnings}
              linkPrefix="/agents"
              emptyText="Нет данных об использованных учениях"
            />
          </SectionCard>

          {/* Row 3: Top library cards */}
          <SectionCard title="Топ карточек библиотеки (library_used)" icon={<Library size={16} />}>
            <TopList
              items={topLibrary}
              linkPrefix="/library"
              emptyText="Нет данных об использованных карточках"
            />
          </SectionCard>

          {/* Row 4: Dead weight — full width */}
          <div className="lg:col-span-2">
            <DeadWeightBlock entries={filtered} />
          </div>

          {/* Row 5: Notes digest — full width */}
          <div className="lg:col-span-2">
            <NotesDigest entries={filtered} />
          </div>
        </div>
      )}
    </div>
  )
}
