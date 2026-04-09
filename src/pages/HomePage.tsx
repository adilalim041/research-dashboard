import { FlaskConical, Library, Bot, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCandidates, useLibrary, useSubagents } from '@/hooks/useGitHub'
import { StatCard } from '@/components/StatCard'
import { CandidateCardComponent } from '@/components/CandidateCard'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ErrorMessage } from '@/components/ErrorMessage'
import { formatDateRu } from '@/lib/utils'
import { clearCache } from '@/services/github'

export function HomePage() {
  const { candidates, loading: cLoading, error: cError } = useCandidates()
  const { items: libraryItems, loading: lLoading } = useLibrary()
  const { agents, loading: aLoading } = useSubagents()

  const loading = cLoading || lLoading || aLoading

  if (loading) return <LoadingSpinner message="Loading dashboard data..." />
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

  const lastRunDate = sortedCandidates[0]?.date || null
  const lastRunFormatted = lastRunDate ? formatDateRu(lastRunDate) : 'N/A'
  const totalLearnings = Array.isArray(agents)
    ? agents.reduce((sum, a) => sum + (a.learningsCount || 0), 0)
    : 0

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Research Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Overview of vault-research-agent activity
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Last Parser Run"
          value={String(lastRunFormatted)}
          icon={<Clock size={20} />}
        />
        <StatCard
          title="Candidates"
          value={String(candidates.length || 0)}
          icon={<FlaskConical size={20} />}
          subtitle="Total evaluated"
        />
        <StatCard
          title="Library Items"
          value={String(libraryItems.length || 0)}
          icon={<Library size={20} />}
          subtitle="Approved tools"
        />
        <StatCard
          title="Subagents"
          value={String(agents.length || 0)}
          icon={<Bot size={20} />}
          subtitle={`${totalLearnings} learnings total`}
        />
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Candidates</h2>
          <Link to="/candidates" className="text-sm text-accent hover:underline">
            View all
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedCandidates.slice(0, 6).map((c) => (
            <CandidateCardComponent key={c.filename} candidate={c} />
          ))}
        </div>
        {sortedCandidates.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No candidates found yet.
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Subagent Status</h2>
          <Link to="/agents" className="text-sm text-accent hover:underline">
            View all
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
              <p className="text-xs text-muted-foreground">learnings</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
