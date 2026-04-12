import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Calendar, Search, Brain, GitFork, ExternalLink, CheckCircle, Microscope } from 'lucide-react'
import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getFileContent } from '@/services/github'
import { useCandidates, useStudies } from '@/hooks/useGitHub'
import {
  getNameFromFilename,
  getDateFromFilename,
  formatDateRu,
  extractScore,
  extractNiche,
  extractCategory,
  extractProject,
  extractUrl,
} from '@/lib/utils'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ErrorMessage } from '@/components/ErrorMessage'
import { cn } from '@/lib/utils'
import type { StudyReport } from '@/types'

// Tab configuration for study section — same as StudiesPage
const TAB_CONFIG: { key: string; label: string }[] = [
  { key: 'overview',  label: 'Обзор'    },
  { key: 'frontend',  label: 'Фронтенд' },
  { key: 'backend',   label: 'Бэкенд'   },
  { key: 'infra',     label: 'Инфра'    },
  { key: 'patterns',  label: 'Паттерны' },
  { key: 'verdict',   label: 'Вердикт'  },
]

function extractFoundBy(content: string): string | null {
  const match = content.match(/\*\*Found by:\*\*\s*(.+)/i)
  return match ? match[1].trim() : null
}

function hasDeepAnalysis(content: string): boolean {
  return content.includes('## Startup potential') ||
         content.includes('## Best features') ||
         content.includes('## How to start using it')
}

// Lazy-loading tab content for study analysis
function StudyTabContent({ folderName, fileKey }: { folderName: string; fileKey: string }) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

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

function StudySection({ study }: { study: StudyReport }) {
  const availableTabs = TAB_CONFIG.filter(t => study.files.includes(t.key))
  const [activeTab, setActiveTab] = useState(availableTabs[0]?.key ?? 'overview')

  if (availableTabs.length === 0) return null

  const recStyles: Record<string, string> = {
    adopt: 'bg-green-500/15 text-green-400 border border-green-500/20',
    watch: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20',
    skip:  'bg-red-500/15  text-red-400  border border-red-500/20',
  }
  const recLabels: Record<string, string> = { adopt: 'Adopt', watch: 'Watch', skip: 'Skip' }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden mb-4">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Microscope size={16} className="text-accent" />
          <h2 className="text-sm font-semibold">Результаты глубокого анализа</h2>
        </div>
        <div className="flex items-center gap-3">
          {study.deepScore !== null && (
            <span className={cn(
              'text-sm font-bold font-mono',
              study.deepScore >= 8 ? 'text-green-400' :
              study.deepScore >= 6 ? 'text-yellow-400' : 'text-red-400'
            )}>
              {study.deepScore.toFixed(1)}
            </span>
          )}
          {study.recommendation && (
            <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide', recStyles[study.recommendation])}>
              {recLabels[study.recommendation]}
            </span>
          )}
        </div>
      </div>

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

      <div className="p-6">
        {availableTabs.map(tab => (
          activeTab === tab.key && (
            <StudyTabContent key={tab.key} folderName={study.folderName} fileKey={tab.key} />
          )
        ))}
      </div>
    </div>
  )
}

export function CandidateDetailPage() {
  const { filename } = useParams<{ filename: string }>()
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load studies to find if this candidate has been studied
  const { studies } = useStudies()
  // Load candidates to get studyStatus
  const { candidates } = useCandidates()

  useEffect(() => {
    if (!filename) return
    setLoading(true)
    getFileContent(`research/candidates/${decodeURIComponent(filename)}`)
      .then(setContent)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [filename])

  if (loading) return <LoadingSpinner message="Загрузка кандидата..." />
  if (error)   return <ErrorMessage message={error} />
  if (!content || !filename) return <ErrorMessage message="Не найдено" />

  const decodedFilename = decodeURIComponent(filename)
  const name = getNameFromFilename(decodedFilename)
  const date = getDateFromFilename(decodedFilename)
  const score = extractScore(content)
  const niche = extractNiche(content)
  const category = extractCategory(content)
  const project = extractProject(content)
  const url = extractUrl(content)
  const foundBy = extractFoundBy(content)
  const isDeep = hasDeepAnalysis(content)

  // Find matching candidate for studyStatus
  const candidateData = candidates.find(c => c.filename === decodedFilename)
  const studyStatus = candidateData?.studyStatus ?? 'found'

  // Find matching study report
  const matchingStudy = studies.find(s =>
    s.candidateFilename === decodedFilename ||
    // Fallback: match by date + name slug from folder
    (date && s.folderName.startsWith(date) && s.repoName.toLowerCase().includes(
      decodedFilename.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '').replace(/-/g, '').toLowerCase()
    ))
  ) ?? null

  const isStudied = studyStatus === 'studied' || studyStatus === 'applied'
  const isApplied = studyStatus === 'applied'

  // Timeline steps — 4 total
  const steps = [
    {
      icon: Search,
      label: 'Найден',
      detail: foundBy || 'vault-research-agent',
      date: date ? formatDateRu(date) : null,
      done: true,
    },
    {
      icon: Brain,
      label: 'Изучен',
      detail: isStudied
        ? (matchingStudy?.recommendation ? `Рекомендация: ${matchingStudy.recommendation}` : 'Глубокий анализ завершён')
        : (isDeep ? 'Базовый анализ есть' : 'Ещё не изучен'),
      date: matchingStudy?.date ? formatDateRu(matchingStudy.date) : null,
      done: isStudied,
    },
    {
      icon: GitFork,
      label: 'В библиотеке',
      detail: 'Одобрен для использования в проектах',
      date: null,
      done: false, // TODO: check if in library
    },
    {
      icon: CheckCircle,
      label: 'Применён',
      detail: 'Использован в продакшн',
      date: null,
      done: isApplied,
    },
  ]

  const scoreColor = score === null ? '' :
    score >= 8 ? 'text-green-400' :
    score >= 6 ? 'text-yellow-400' :
    'text-red-400'

  return (
    <div>
      <Link
        to="/candidates"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        Назад к кандидатам
      </Link>

      {/* Meta info card */}
      <div className="bg-card border border-border rounded-xl p-5 mb-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold">{name}</h1>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:underline flex items-center gap-1 mt-1"
              >
                {url.replace('https://github.com/', '')}
                <ExternalLink size={12} />
              </a>
            )}
          </div>
          {score !== null && (
            <div className="text-right shrink-0">
              <span className={cn('text-3xl font-bold font-mono', scoreColor)}>
                {score.toFixed(1)}
              </span>
              <span className="text-sm text-muted-foreground">/10</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {date && (
            <span className="flex items-center gap-1 bg-muted px-2.5 py-1 rounded-md">
              <Calendar size={12} />
              {formatDateRu(date)}
            </span>
          )}
          <span className="bg-muted px-2.5 py-1 rounded-md">
            {project}
          </span>
          {niche && niche !== 'unknown' && (
            <span className="bg-accent/10 text-accent px-2.5 py-1 rounded-md">
              {niche}
            </span>
          )}
          {category && category !== 'general' && (
            <span className="bg-muted px-2.5 py-1 rounded-md">
              {category}
            </span>
          )}
        </div>
      </div>

      {/* Processing timeline — 4 steps */}
      <div className="bg-card border border-border rounded-xl p-5 mb-4">
        <h2 className="text-sm font-semibold text-muted-foreground mb-4">Этапы обработки</h2>
        <div className="flex items-start gap-0">
          {steps.map((step, i) => (
            <div key={step.label} className="flex-1 relative">
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className={cn(
                  'absolute top-4 left-[calc(50%+16px)] right-0 h-0.5',
                  step.done ? 'bg-accent' : 'bg-border'
                )} />
              )}
              <div className="flex flex-col items-center text-center relative z-10">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center mb-2',
                  step.done ? 'bg-accent/20 text-accent' : 'bg-muted text-muted-foreground'
                )}>
                  <step.icon size={16} />
                </div>
                <p className={cn(
                  'text-xs font-medium',
                  step.done ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {step.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-[120px]">
                  {step.detail}
                </p>
                {step.date && (
                  <p className="text-xs text-muted-foreground/70 mt-0.5">
                    {step.date}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Study analysis section — shown only if study data exists */}
      {matchingStudy && <StudySection study={matchingStudy} />}

      {/* Full content */}
      <div className="bg-card border border-border rounded-xl p-6 lg:p-8">
        <div className="markdown-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
