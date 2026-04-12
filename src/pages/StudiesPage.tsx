import { useState } from 'react'
import { Microscope, Calendar, ChevronLeft, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useStudies } from '@/hooks/useGitHub'
import { getFileContent } from '@/services/github'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ErrorMessage } from '@/components/ErrorMessage'
import { cn, formatDateRu } from '@/lib/utils'
import type { StudyReport } from '@/types'

// Tab definitions — only those whose file exists in report.files[] will be shown
const TAB_CONFIG: { key: string; label: string }[] = [
  { key: 'overview',  label: 'Обзор'      },
  { key: 'frontend',  label: 'Фронтенд'   },
  { key: 'backend',   label: 'Бэкенд'     },
  { key: 'infra',     label: 'Инфра'      },
  { key: 'patterns',  label: 'Паттерны'   },
  { key: 'verdict',   label: 'Вердикт'    },
]

function RecommendationBadge({ rec }: { rec: StudyReport['recommendation'] }) {
  if (!rec) return null
  const styles = {
    adopt: 'bg-green-500/15 text-green-400 border border-green-500/20',
    watch: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20',
    skip:  'bg-red-500/15  text-red-400  border border-red-500/20',
  }
  const labels = { adopt: 'Adopt', watch: 'Watch', skip: 'Skip' }
  return (
    <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide', styles[rec])}>
      {labels[rec]}
    </span>
  )
}

function ScoreDisplay({ score }: { score: number | null }) {
  if (score === null) return <span className="text-3xl font-bold font-mono text-muted-foreground">—</span>
  const color = score >= 8 ? 'text-green-400' : score >= 6 ? 'text-yellow-400' : 'text-red-400'
  return (
    <span className={cn('text-4xl font-bold font-mono', color)}>
      {score.toFixed(1)}
    </span>
  )
}

function StudyCard({ report, onClick }: { report: StudyReport; onClick: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className="bg-card border border-border rounded-xl p-5 hover:border-accent/40 transition-colors cursor-pointer group"
    >
      {/* Header: score + recommendation */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <ScoreDisplay score={report.deepScore} />
          <p className="text-xs text-muted-foreground mt-0.5">deep score</p>
        </div>
        <RecommendationBadge rec={report.recommendation} />
      </div>

      {/* Repo name */}
      <h3 className="font-semibold text-sm group-hover:text-accent transition-colors mb-3 line-clamp-2">
        {report.repoName}
      </h3>

      {/* Stack tags */}
      {report.stack.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {report.stack.slice(0, 5).map(s => (
            <span key={s} className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded">
              {s}
            </span>
          ))}
          {report.stack.length > 5 && (
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
              +{report.stack.length - 5}
            </span>
          )}
        </div>
      )}

      {/* Date */}
      {report.date && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar size={12} />
          {formatDateRu(report.date)}
        </div>
      )}
    </div>
  )
}

// ─── Detail View ─────────────────────────────────────────────────────────────

interface TabContentProps {
  folderName: string
  fileKey: string
}

function TabContent({ folderName, fileKey }: TabContentProps) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Lazy-load on first render of this tab
  if (!loaded && !loading) {
    setLoading(true)
    setLoaded(true)
    getFileContent(`research/studies/${folderName}/${fileKey}.md`)
      .then(c => { setContent(c); setLoading(false) })
      .catch(e => { setError(e instanceof Error ? e.message : 'Ошибка загрузки'); setLoading(false) })
  }

  if (loading) return <LoadingSpinner message="Загрузка..." />
  if (error)   return <p className="text-sm text-red-400 py-4">{error}</p>
  if (!content) return null

  return (
    <div className="markdown-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}

function StudyDetailView({ report, onClose }: { report: StudyReport; onClose: () => void }) {
  // Only show tabs that have a corresponding file
  const availableTabs = TAB_CONFIG.filter(t => report.files.includes(t.key))
  const [activeTab, setActiveTab] = useState(availableTabs[0]?.key ?? 'overview')

  return (
    <div>
      {/* Back button */}
      <button
        onClick={onClose}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ChevronLeft size={16} />
        Назад к глубокому анализу
      </button>

      {/* Header card */}
      <div className="bg-card border border-border rounded-xl p-5 mb-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold">{report.repoName}</h1>
            {report.date && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                <Calendar size={13} />
                {formatDateRu(report.date)}
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <ScoreDisplay score={report.deepScore} />
            <div className="mt-1">
              <RecommendationBadge rec={report.recommendation} />
            </div>
          </div>
        </div>

        {/* Stack */}
        {report.stack.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {report.stack.map(s => (
              <span key={s} className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      {availableTabs.length > 0 ? (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Tab bar */}
          <div className="flex gap-0 border-b border-border overflow-x-auto">
            {availableTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
                  activeTab === tab.key
                    ? 'border-accent text-accent'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-6">
            {availableTabs.map(tab => (
              activeTab === tab.key && (
                <TabContent key={tab.key} folderName={report.folderName} fileKey={tab.key} />
              )
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground text-sm">Файлы анализа недоступны.</p>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function StudiesPage() {
  const { studies, loading, error, reload } = useStudies()
  const [selectedStudy, setSelectedStudy] = useState<StudyReport | null>(null)

  if (loading) return <LoadingSpinner message="Загрузка глубокого анализа..." />
  if (error)   return <ErrorMessage message={error} onRetry={reload} />

  // Detail view
  if (selectedStudy) {
    return <StudyDetailView report={selectedStudy} onClose={() => setSelectedStudy(null)} />
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Глубокий анализ</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {studies.length} репозиториев изучено подробно
        </p>
      </div>

      {studies.length === 0 ? (
        // Empty state
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-5">
            <Microscope size={32} className="text-accent" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Нет изученных репо</h2>
          <p className="text-muted-foreground text-sm max-w-sm leading-relaxed">
            Скажи Claude «изучи top 5» чтобы начать глубокий анализ.
            Результаты появятся здесь автоматически после следующего запуска агента.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {studies.map(study => (
            <StudyCard
              key={study.folderName}
              report={study}
              onClick={() => setSelectedStudy(study)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
