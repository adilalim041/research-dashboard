import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Calendar, Search, Brain, GitFork, ExternalLink } from 'lucide-react'
import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getFileContent } from '@/services/github'
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

function extractFoundBy(content: string): string | null {
  const match = content.match(/\*\*Found by:\*\*\s*(.+)/i)
  return match ? match[1].trim() : null
}

function hasDeepAnalysis(content: string): boolean {
  // Cards with "Startup potential", "Best features", "Risks and gotchas" = deep analysis
  return content.includes('## Startup potential') ||
         content.includes('## Best features') ||
         content.includes('## How to start using it')
}

export function CandidateDetailPage() {
  const { filename } = useParams<{ filename: string }>()
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!filename) return
    setLoading(true)
    getFileContent(`research/candidates/${decodeURIComponent(filename)}`)
      .then(setContent)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [filename])

  if (loading) return <LoadingSpinner message="Загрузка кандидата..." />
  if (error) return <ErrorMessage message={error} />
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

  // Timeline steps
  const steps = [
    {
      icon: Search,
      label: 'Найден парсером',
      detail: foundBy || 'vault-research-agent',
      date: date ? formatDateRu(date) : null,
      done: true,
    },
    {
      icon: Brain,
      label: 'Глубокий анализ',
      detail: isDeep ? 'Startup potential, use cases, risks' : 'Базовый анализ',
      date: date ? formatDateRu(date) : null,
      done: true,
    },
    {
      icon: GitFork,
      label: 'В библиотеку',
      detail: 'Одобрен для использования в проектах',
      date: null,
      done: false, // TODO: check if in library
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

      {/* Processing timeline */}
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
                <p className="text-xs text-muted-foreground mt-0.5 max-w-[140px]">
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
