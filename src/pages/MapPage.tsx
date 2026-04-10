import { Map } from 'lucide-react'
import { useCandidates, useRunReports } from '@/hooks/useGitHub'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ErrorMessage } from '@/components/ErrorMessage'
import { ResearchMap } from '@/components/ResearchMap'
import { clearCache } from '@/services/github'

export function MapPage() {
  const { candidates, loading: candLoading, error: candError } = useCandidates()
  const { reports, loading: repLoading, error: repError } = useRunReports()

  const loading = candLoading || repLoading
  const error = candError || repError

  if (loading) return <LoadingSpinner message="Загрузка данных карты..." />
  if (error) {
    return <ErrorMessage message={String(error)} onRetry={() => { clearCache(); window.location.reload() }} />
  }

  // Aggregate stats from latest report
  const latest = reports && reports.length > 0 ? reports[0] : null
  const totalFound = latest?.totalFound || 0
  const unique = latest?.uniqueAfterDedup || 0
  const accepted = latest?.accepted || 0
  const allNiches = latest?.niches || []

  // Funnel percentages
  const funnel = [
    { label: 'Найдено', value: totalFound, color: 'bg-blue-500', pct: 100 },
    { label: 'Уникальных', value: unique, color: 'bg-yellow-500', pct: totalFound > 0 ? Math.round((unique / totalFound) * 100) : 0 },
    { label: 'Принято', value: accepted, color: 'bg-green-500', pct: totalFound > 0 ? Math.round((accepted / totalFound) * 100) : 0 },
  ]

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Map size={24} className="text-accent" />
          <h1 className="text-2xl font-bold">Карта территорий</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          Территории исследований. Размер = находки, цвет = глубина. Клик → кандидаты.
        </p>
      </div>

      {/* Territory Map */}
      <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
        <ResearchMap candidates={candidates} niches={allNiches} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold font-mono text-accent">{candidates.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Кандидатов</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold font-mono text-accent">{allNiches.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Ниш</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold font-mono text-accent">{reports.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Запусков</p>
        </div>
      </div>

      {/* Funnel */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground mb-4">Воронка последнего запуска</h2>
        {latest ? (
          <div className="space-y-3">
            {funnel.map((step) => (
              <div key={step.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{step.label}</span>
                  <span className="font-mono font-bold">{step.value}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-6 overflow-hidden">
                  <div
                    className={`${step.color} h-full rounded-full flex items-center justify-center text-xs font-bold text-white`}
                    style={{ width: `${Math.max(step.pct, 5)}%` }}
                  >
                    {step.pct}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Нет данных о запусках</p>
        )}
      </div>

      {/* Run history */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-muted-foreground mb-4">История запусков ({reports.length})</h2>
        <div className="space-y-3">
          {reports.map((run) => {
            const rate = run.totalFound > 0 ? Math.round((run.accepted / run.totalFound) * 100) : 0
            return (
              <div key={run.filename} className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground w-36 shrink-0">{run.displayDate}</span>
                <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-accent h-full rounded-full"
                    style={{ width: `${Math.max(rate, 3)}%` }}
                  />
                </div>
                <span className="font-mono w-20 text-right shrink-0">
                  {run.accepted}/{run.totalFound}
                </span>
                <span className="text-muted-foreground w-12 text-right">{rate}%</span>
              </div>
            )
          })}
          {reports.length === 0 && (
            <p className="text-muted-foreground text-sm">Нет запусков</p>
          )}
        </div>
      </div>
    </div>
  )
}
