import { useState, useMemo } from 'react'
import { Search, FolderOpen } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useLibrary } from '@/hooks/useGitHub'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ErrorMessage } from '@/components/ErrorMessage'
import { cn } from '@/lib/utils'

export function LibraryPage() {
  const { items, categories, loading, error, reload } = useLibrary()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [expandedItem, setExpandedItem] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let result = [...items]
    if (activeCategory !== 'all') {
      result = result.filter(i => i.category === activeCategory)
    }
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        i => i.name.toLowerCase().includes(q) || i.content.toLowerCase().includes(q)
      )
    }
    return result
  }, [items, search, activeCategory])

  if (loading) return <LoadingSpinner message="Loading library..." />
  if (error) return <ErrorMessage message={error} onRetry={reload} />

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Library</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {items.length} approved tools across {categories.length} categories
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search library..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-card border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-accent"
        />
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveCategory('all')}
          className={cn(
            'px-3 py-1.5 text-sm rounded-lg border transition-colors',
            activeCategory === 'all'
              ? 'bg-accent/10 border-accent/30 text-accent'
              : 'bg-card border-border text-muted-foreground hover:text-foreground'
          )}
        >
          All ({items.length})
        </button>
        {categories.map(cat => {
          const count = items.filter(i => i.category === cat).length
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                activeCategory === cat
                  ? 'bg-accent/10 border-accent/30 text-accent'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground'
              )}
            >
              {cat} ({count})
            </button>
          )
        })}
      </div>

      {/* Items */}
      <div className="space-y-3">
        {filtered.map(item => (
          <div
            key={item.path}
            className="bg-card border border-border rounded-xl overflow-hidden"
          >
            <button
              onClick={() => setExpandedItem(expandedItem === item.path ? null : item.path)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
            >
              <FolderOpen size={16} className="text-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm">{item.name}</h3>
                <p className="text-xs text-muted-foreground">{item.category}</p>
              </div>
              <span className="text-muted-foreground text-xs">
                {expandedItem === item.path ? 'Collapse' : 'Expand'}
              </span>
            </button>
            {expandedItem === item.path && (
              <div className="px-4 pb-4 border-t border-border pt-4">
                <div className="markdown-content text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {item.content}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-12">
          No library items match your search.
        </p>
      )}
    </div>
  )
}
