import { useMemo } from 'react'
import { FlaskConical, Library, Bot, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useCandidates, useLibrary, useSubagents } from '@/hooks/useGitHub'
import { StatCard } from '@/components/StatCard'
import { CandidateCardComponent } from '@/components/CandidateCard'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ErrorMessage } from '@/components/ErrorMessage'
import { formatDateRu } from '@/lib/utils'

export function HomePage() {
  const { candidates, loading: cLoading, error: cError } = useCandidates()
  const { items: libraryItems, loading: lLoading } = useLibrary()
  const { agents, loading: aLoading } = useSubagents()

  const loading = cLoading || lLoading || aLoading

  if (loading) return <LoadingSpinner message="Loading dashboard data..." />
  if (cError) {
    const handleRetry = () => {
      import('@/services/github').then(m => m.clearCache())
      window.location.reload()
    }
    return <ErrorMessage message={cError} onRetry={handleRetry} />
  }

  const sortedCandidates = [...candidates].sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date)
    return 0
  })

  const lastRunDate = sortedCandidates[0]?.date
  const lastRunFormatted = lastRunDate ? formatDateRu(lastRunDate) : 'Unknown'
  const totalLearnings = agents.reduce((sum, a) => sum + a.learningsCount, 0)

  // Group candidates by date for the chart
  const chartData = useMemo(() => {
    const byDate = new Map<string, number>()
    for (const c of candidates) {
      const d = c.date || 'Unknown'
      byDate.set(d, (byDate.get(d) || 0) + 1)
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({
        date: date !== 'Unknown' ? formatDateRu(date) : date,
        count,
      }))
  }, [candidates])

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Research Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Overview of vault-research-agent activity
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Last Parser Run"
          value={lastRunFormatted}
          icon={<Clock size={20} />}
        />
        <StatCard
          title="Candidates"
          value={candidates.length}
          icon={<FlaskConical size={20} />}
          subtitle="Total evaluated"
        />
        <StatCard
          title="Library Items"
          value={libraryItems.length}
          icon={<Library size={20} />}
          subtitle="Approved tools"
        />
        <StatCard
          title="Subagents"
          value={agents.length}
          icon={<Bot size={20} />}
          subtitle={`${totalLearnings} learnings total`}
        />
      </div>

      {/* Candidates per day chart */}
      {chartData.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 mb-8">
          <h2 className="text-sm font-semibold mb-4 text-muted-foreground">Candidates by Day</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis
                dataKey="date"
                tick={{ fill: '#8b8b9e', fontSize: 11 }}
                axisLine={{ stroke: '#1e1e2e' }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: '#8b8b9e', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: '#111118',
                  border: '1px solid #1e1e2e',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#e4e4e7',
                }}
                cursor={{ fill: 'rgba(99, 102, 241, 0.08)' }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill="#6366f1" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent candidates */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Candidates</h2>
          <Link
            to="/candidates"
            className="text-sm text-accent hover:underline"
          >
            View all
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedCandidates.slice(0, 6).map((c) => (
            <CandidateCardComponent key={c.filename} candidate={c} />
          ))}
        </div>
        {candidates.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No candidates found. Check if the research/candidates directory exists in the vault.
          </p>
        )}
      </div>

      {/* Subagent status */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Subagent Status</h2>
          <Link
            to="/agents"
            className="text-sm text-accent hover:underline"
          >
            View all
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {agents.map((agent) => (
            <Link
              key={agent.name}
              to="/agents"
              className="bg-card border border-border rounded-xl p-4 hover:border-accent/40 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <Bot size={16} className="text-accent" />
                <h3 className="font-medium text-sm">{agent.displayName}</h3>
              </div>
              <p className="text-2xl font-bold font-mono">{agent.learningsCount}</p>
              <p className="text-xs text-muted-foreground">learnings</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
