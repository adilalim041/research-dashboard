import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getFileContent } from '@/services/github'
import { getNameFromFilename } from '@/lib/utils'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ErrorMessage } from '@/components/ErrorMessage'

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

  const name = getNameFromFilename(decodeURIComponent(filename))

  return (
    <div>
      <Link
        to="/candidates"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        Назад к кандидатам
      </Link>

      <div className="bg-card border border-border rounded-xl p-6 lg:p-8">
        <h1 className="text-xl font-bold mb-6">{name}</h1>
        <div className="markdown-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
