import { FlaskConical, Library, Bot, Clock, Microscope } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCandidates, useLibrary, useSubagents, useLastRunTime, useStudies } from '@/hooks/useGitHub'
import { StatCard } from '@/components/StatCard'
import { CandidateCardComponent } from '@/components/CandidateCard'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ErrorMessage } from '@/components/ErrorMessage'
import { clearCache } from '@/services/github'
import type { CandidateCard } from '@/types'

// ─── Known usage-type order + display labels ─────────────────────────────────
const HOME_TYPE_ORDER = ['library', 'tool', 'product-idea', 'pattern', 'reference']
const HOME_TYPE_LABELS: Record<string, string> = {
  library:        'Library',
  tool:           'Tool',
  'product-idea': 'Product idea',
  pattern:        'Pattern',
  reference:      'Reference',
  untyped:        'Other',
}

/**
 * Groups candidates by usageType and renders compact cards per group.
 * Used on HomePage "Последние находки" section.
 */
function HomeRecentCandidates({ candidates }: { candidates: CandidateCard[] }) {
  // Build ordered group map
  const map = new Map<string, CandidateCard[]>()
  for (const c of candidates) {
    const key = c.usageType || 'untyped'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(c)
  }

  const ordered = new Map<string, CandidateCard[]>()
  for (const t of HOME_TYPE_ORDER) {
    if (map.has(t)) ordered.set(t, map.get(t)!)
  }
  if (map.has('untyped')) ordered.set('untyped', map.get('untyped')!)
  for (const [k, v] of map) {
    if (!ordered.has(k)) ordered.set(k, v)
  }

  const groups = Array.from(ordered.entries())

  // If all cards have no usageType, fall back to flat list
  if (groups.length === 1 && groups[0][0] === 'untyped') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {candidates.map(c => (
          <CandidateCardComponent key={c.filename} candidate={c} compact />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {groups.map(([type, cards]) => (
        <section key={type}>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {HOME_TYPE_LABELS[type] || type}
            <span className="ml-1.5 font-normal normal-case">({cards.length})</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {cards.map(c => (
              <CandidateCardComponent key={c.filename} candidate={c} compact />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export function HomePage() {
  const { candidates, loading: cLoading, error: cError } = useCandidates()
  const { items: libraryItems, loading: lLoading } = useLibrary()
  const { agents, loading: aLoading } = useSubagents()
  const { formatted: lastRunFormatted, timeAgo, loading: rLoading } = useLastRunTime()
  const { studies, loading: sLoading } = useStudies()

  const loading = cLoading || lLoading || aLoading || rLoading || sLoading

  if (loading) return <LoadingSpinner message="Загрузка данных..." />
  if (cError) {
    const handleRetry = () => {
      clearCache()
      window.location.reload()
    }
    return <ErrorMessage message={cError} onRetry={handleRetry} />
  }

  const sortedCandidates = Array.isArray(candidates)
    ? [...candidates].sort((a, b) => {
        const da = a.date || ''
        const db = b.date || ''
        return db.localeCompare(da)
      })
    : []

  const totalLearnings = Array.isArray(agents)
    ? agents.reduce((sum, a) => sum + (a.learningsCount || 0), 0)
    : 0

  // Candidates awaiting deep analysis (status = 'found' but no study yet)
  const awaitingAnalysis = Array.isArray(candidates)
    ? candidates.filter(c => c.studyStatus === 'found').length
    : 0

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Панель исследований</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Обзор активности ночного ресёрч-агента
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard
          title="Последний парсинг"
          value={lastRunFormatted}
          icon={<Clock size={20} />}
          subtitle={timeAgo}
        />
        <StatCard
          title="Кандидаты"
          value={String(candidates.length || 0)}
          icon={<FlaskConical size={20} />}
          subtitle="Всего найдено"
        />
        <StatCard
          title="Изучено"
          value={String(studies.length || 0)}
          icon={<Microscope size={20} />}
          subtitle={`${awaitingAnalysis} ожидают анализа`}
        />
        <StatCard
          title="Библиотека"
          value={String(libraryItems.length || 0)}
          icon={<Library size={20} />}
          subtitle="Одобренных"
        />
        <StatCard
          title="Субагенты"
          value={String(agents.length || 0)}
          icon={<Bot size={20} />}
          subtitle={`${totalLearnings} записей знаний`}
        />
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Последние находки</h2>
          <Link to="/candidates" className="text-sm text-accent hover:underline">
            Все
          </Link>
        </div>

        {sortedCandidates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Кандидатов не найдено
          </p>
        ) : (
          <HomeRecentCandidates candidates={sortedCandidates.slice(0, 20)} />
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Статус субагентов</h2>
          <Link to="/agents" className="text-sm text-accent hover:underline">
            Все
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(agents || []).map((agent) => (
            <Link
              key={agent.name}
              to="/agents"
              className="bg-card border border-border rounded-xl p-4 hover:border-accent/40 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <Bot size={16} className="text-accent" />
                <h3 className="font-medium text-sm">{agent.displayName}</h3>
              </div>
              <p className="text-2xl font-bold font-mono">{agent.learningsCount || 0}</p>
              <p className="text-xs text-muted-foreground">записей</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
