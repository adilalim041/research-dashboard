import { useMemo } from 'react'
import { Search, GitBranch, Newspaper, TrendingUp, Map } from 'lucide-react'
import { useRunReports } from '@/hooks/useGitHub'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ErrorMessage } from '@/components/ErrorMessage'
import { cn } from '@/lib/utils'
import type { RunReport, NicheInfo } from '@/types'

// ─── Source detection ────────────────────────────────────────────────────────

interface SourceStats {
  name: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  count: number
  color: string
}

function detectSources(reports: RunReport[]): SourceStats[] {
  // Count niches that map to each source
  const nicheCounts: Record<string, number> = {}
  for (const report of reports) {
    for (const niche of report.niches) {
      nicheCounts[niche.name] = (nicheCounts[niche.name] ?? 0) + report.totalFound
    }
  }

  // Map niche names → source
  const duckNiches = ['frontend-ui', 'ai-tools', 'python-tools', 'saas-boilerplate',
    'ai-new', 'devops-infra', 'databases', 'whatsapp-tools', 'content-media',
    'ai-reliability', 'content-automation', 'python-agents', 'devops-tools']
  const hnNiches = ['hn-trending']
  const trendingNiches = ['trending-github']
  const githubApiNiches = ['github-api', 'github-search']

  const sumNiches = (names: string[]) =>
    names.reduce((sum, n) => sum + (nicheCounts[n] ?? 0), 0)

  const totalFound = reports.reduce((s, r) => s + r.totalFound, 0)
  const hnCount = sumNiches(hnNiches)
  const trendingCount = sumNiches(trendingNiches)
  const githubApiCount = sumNiches(githubApiNiches)
  const duckCount = Math.max(0, totalFound - hnCount - trendingCount - githubApiCount)

  return [
    {
      name: 'duckduckgo',
      label: 'DuckDuckGo',
      icon: Search,
      count: duckCount,
      color: 'text-blue-400',
    },
    {
      name: 'github-api',
      label: 'GitHub API',
      icon: GitBranch,
      count: githubApiCount,
      color: 'text-purple-400',
    },
    {
      name: 'hacker-news',
      label: 'Hacker News',
      icon: Newspaper,
      count: hnCount,
      color: 'text-orange-400',
    },
    {
      name: 'github-trending',
      label: 'GitHub Trending',
      icon: TrendingUp,
      count: trendingCount,
      color: 'text-green-400',
    },
  ]
}

// ─── Aggregated niche stats ───────────────────────────────────────────────────

interface NicheStats extends NicheInfo {
  totalCandidates: number
  runsAppeared: number
}

function aggregateNiches(reports: RunReport[]): NicheStats[] {
  const map = new Map<string, NicheStats>()
  for (const report of reports) {
    // Distribute candidates evenly across niches in a run
    const perNiche = report.niches.length > 0
      ? Math.round(report.totalFound / report.niches.length)
      : 0
    for (const niche of report.niches) {
      const existing = map.get(niche.name)
      if (existing) {
        existing.totalCandidates += perNiche
        existing.runsAppeared += 1
        // Merge keywords (keep unique)
        for (const kw of niche.keywords) {
          if (!existing.keywords.includes(kw)) existing.keywords.push(kw)
        }
      } else {
        map.set(niche.name, {
          name: niche.name,
          keywords: [...niche.keywords],
          totalCandidates: perNiche,
          runsAppeared: 1,
        })
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.totalCandidates - a.totalCandidates)
}

// ─── Funnel block ─────────────────────────────────────────────────────────────

interface FunnelStepProps {
  label: string
  value: number
  maxValue: number
  color: string
  textColor: string
  percent: number
}

function FunnelStep({ label, value, maxValue, color, textColor, percent }: FunnelStepProps) {
  const widthPct = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0

  return (
    <div className="flex items-center gap-4">
      <div className="w-28 text-right shrink-0">
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="flex-1 h-10 bg-muted/30 rounded-lg overflow-hidden relative">
        <div
          className={cn('h-full rounded-lg flex items-center justify-end pr-4 transition-all', color)}
          style={{ width: `${widthPct}%` }}
        >
          <span className={cn('font-bold font-mono text-sm', textColor)}>{value}</span>
        </div>
      </div>
      <div className="w-14 shrink-0">
        <span className="text-xs text-muted-foreground font-mono">{percent}%</span>
      </div>
    </div>
  )
}

// ─── Niche heat card ──────────────────────────────────────────────────────────

function NicheCard({ niche, maxCount }: { niche: NicheStats; maxCount: number }) {
  const intensity = maxCount > 0 ? niche.totalCandidates / maxCount : 0
  // Map intensity to opacity classes for the background accent
  const bgClass = intensity > 0.7
    ? 'bg-accent/20 border-accent/40'
    : intensity > 0.4
    ? 'bg-accent/10 border-accent/20'
    : 'bg-card border-border'

  return (
    <div className={cn('rounded-xl border p-4 flex flex-col gap-2 transition-colors', bgClass)}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-foreground leading-tight">{niche.name}</span>
        <span
          className={cn(
            'shrink-0 text-xs font-bold font-mono px-2 py-0.5 rounded-full',
            intensity > 0.4 ? 'bg-accent/20 text-accent' : 'bg-muted text-muted-foreground'
          )}
        >
          {niche.totalCandidates}
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
        {niche.keywords.slice(0, 4).join(', ')}
      </p>
      <div className="mt-auto pt-1">
        <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent/60 rounded-full transition-all"
            style={{ width: `${Math.round(intensity * 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Run history row ──────────────────────────────────────────────────────────

function RunHistoryRow({ report, maxFound }: { report: RunReport; maxFound: number }) {
  const acceptRate = report.totalFound > 0
    ? Math.round((report.accepted / report.totalFound) * 100)
    : 0
  const barWidth = maxFound > 0 ? Math.round((report.totalFound / maxFound) * 100) : 0

  return (
    <div className="flex items-center gap-4 py-3 border-b border-border last:border-0">
      <div className="w-40 shrink-0">
        <p className="text-sm font-medium text-foreground">{report.displayDate}</p>
        {report.durationSeconds && (
          <p className="text-xs text-muted-foreground">
            {Math.round(report.durationSeconds / 60)} мин
          </p>
        )}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs text-muted-foreground font-mono">
            {report.totalFound} найдено
          </span>
          <span className="text-xs text-muted-foreground">→</span>
          <span className="text-xs font-semibold text-accent font-mono">
            {report.accepted} принято
          </span>
          <span className="text-xs text-muted-foreground ml-auto">
            {acceptRate}% прошли
          </span>
        </div>
        <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent/50 rounded-full"
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>
      <div className="w-20 shrink-0 text-right">
        <span className="text-xs text-muted-foreground">
          {report.niches.length} ниш
        </span>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function MapPage() {
  const { reports, loading, error, reload } = useRunReports()

  const aggregated = useMemo(() => {
    if (reports.length === 0) return null

    const totalFound = reports.reduce((s, r) => s + r.totalFound, 0)
    const totalUnique = reports.reduce((s, r) => s + r.uniqueAfterDedup, 0)
    const totalAccepted = reports.reduce((s, r) => s + r.accepted, 0)
    const totalCards = reports.reduce((s, r) => s + r.cardsWritten, 0)

    const sources = detectSources(reports)
    const niches = aggregateNiches(reports)
    const maxNicheCount = niches[0]?.totalCandidates ?? 1
    const maxRunFound = Math.max(...reports.map(r => r.totalFound), 1)

    const recentRuns = [...reports].slice(0, 10)

    return {
      totalFound,
      totalUnique,
      totalAccepted,
      totalCards,
      sources,
      niches,
      maxNicheCount,
      maxRunFound,
      recentRuns,
    }
  }, [reports])

  if (loading) return <LoadingSpinner message="Загружаю карту поиска..." />
  if (error) return <ErrorMessage message={error} onRetry={reload} />
  if (!aggregated) {
    return (
      <p className="text-center text-muted-foreground py-12">
        Запусков пока нет.
      </p>
    )
  }

  const { totalFound, totalUnique, totalAccepted, totalCards,
    sources, niches, maxNicheCount, maxRunFound, recentRuns } = aggregated

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Map size={22} className="text-accent" />
          <h1 className="text-2xl font-bold">Карта поиска</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Визуальный отчёт по {reports.length} запускам парсера
        </p>
      </div>

      {/* Section 1: Funnel */}
      <section>
        <h2 className="text-base font-semibold mb-4 text-foreground">Воронка поиска</h2>
        <div className="bg-card border border-border rounded-xl p-6 space-y-3">
          <FunnelStep
            label="Найдено"
            value={totalFound}
            maxValue={totalFound}
            color="bg-blue-500/20"
            textColor="text-blue-400"
            percent={100}
          />
          <FunnelStep
            label="Уникальных"
            value={totalUnique}
            maxValue={totalFound}
            color="bg-yellow-500/20"
            textColor="text-yellow-400"
            percent={totalFound > 0 ? Math.round((totalUnique / totalFound) * 100) : 0}
          />
          <FunnelStep
            label="Принято"
            value={totalAccepted}
            maxValue={totalFound}
            color="bg-accent/20"
            textColor="text-accent"
            percent={totalFound > 0 ? Math.round((totalAccepted / totalFound) * 100) : 0}
          />
          <FunnelStep
            label="Карточек"
            value={totalCards}
            maxValue={totalFound}
            color="bg-green-500/20"
            textColor="text-green-400"
            percent={totalFound > 0 ? Math.round((totalCards / totalFound) * 100) : 0}
          />

          <div className="pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Из <span className="font-semibold text-foreground">{totalFound}</span> кандидатов
              отобрано <span className="font-semibold text-accent">{totalCards}</span> карточек
              ({totalFound > 0 ? Math.round((totalCards / totalFound) * 100) : 0}% конверсия)
            </p>
          </div>
        </div>
      </section>

      {/* Section 2: Sources */}
      <section>
        <h2 className="text-base font-semibold mb-4 text-foreground">Источники</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {sources.map(src => {
            const Icon = src.icon
            return (
              <div
                key={src.name}
                className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3"
              >
                <div className="flex items-center gap-2">
                  <Icon size={16} className={src.color} />
                  <span className="text-xs font-medium text-foreground">{src.label}</span>
                </div>
                <p className={cn('text-2xl font-bold font-mono', src.color)}>
                  {src.count}
                </p>
                <p className="text-xs text-muted-foreground">кандидатов</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Section 3: Niche heatmap */}
      <section>
        <h2 className="text-base font-semibold mb-1 text-foreground">Ниши</h2>
        <p className="text-xs text-muted-foreground mb-4">
          {niches.length} ниш по всем запускам — ярче = больше кандидатов
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {niches.map(niche => (
            <NicheCard key={niche.name} niche={niche} maxCount={maxNicheCount} />
          ))}
        </div>
      </section>

      {/* Section 4: Run history */}
      <section>
        <h2 className="text-base font-semibold mb-4 text-foreground">История запусков</h2>
        <div className="bg-card border border-border rounded-xl px-6">
          {recentRuns.map(report => (
            <RunHistoryRow
              key={report.filename}
              report={report}
              maxFound={maxRunFound}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
