import { Bot, BookOpen, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { useSubagents } from '@/hooks/useGitHub'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ErrorMessage } from '@/components/ErrorMessage'
import { cn } from '@/lib/utils'

export function AgentsPage() {
  const { agents, loading, error, reload } = useSubagents()
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)

  if (loading) return <LoadingSpinner message="Loading subagents..." />
  if (error) return <ErrorMessage message={error} onRetry={reload} />

  const totalLearnings = agents.reduce((sum, a) => sum + a.learningsCount, 0)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Subagents</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {agents.length} research agents with {totalLearnings} total learnings
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map(agent => {
          const isExpanded = expandedAgent === agent.name
          return (
            <div
              key={agent.name}
              className="bg-card border border-border rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setExpandedAgent(isExpanded ? null : agent.name)}
                className="w-full p-5 text-left hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Bot size={20} className="text-accent" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{agent.displayName}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {agent.role || 'No role description'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-lg font-bold font-mono">{agent.learningsCount}</p>
                      <p className="text-xs text-muted-foreground">learnings</p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp size={16} className="text-muted-foreground" />
                    ) : (
                      <ChevronDown size={16} className="text-muted-foreground" />
                    )}
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="px-5 pb-5 border-t border-border pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen size={14} className="text-muted-foreground" />
                    <h4 className="text-sm font-medium">Recent Learnings</h4>
                  </div>
                  {agent.recentLearnings.length > 0 ? (
                    <ul className="space-y-2">
                      {agent.recentLearnings.map((learning, i) => (
                        <li
                          key={i}
                          className={cn(
                            'text-xs text-muted-foreground pl-3 border-l-2 border-border py-1',
                            'leading-relaxed'
                          )}
                        >
                          {learning}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">No learnings recorded yet.</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {agents.length === 0 && (
        <p className="text-center text-muted-foreground py-12">
          No subagents found in the vault.
        </p>
      )}
    </div>
  )
}
