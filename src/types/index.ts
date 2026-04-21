export interface GitHubFile {
  name: string
  path: string
  sha: string
  size: number
  type: 'file' | 'dir'
  download_url: string | null
  content?: string
  encoding?: string
}

export interface CandidateCard {
  name: string
  filename: string
  path: string
  score: number | null
  project: string
  description: string
  date: string | null
  url: string | null
  content: string
  niche: string
  category: string
  studyStatus: 'found' | 'studied' | 'applied' | 'promoted-tier-A' | 'promoted-tier-B' | 'rejected'
  /** From **Usage type:** field — library | tool | product-idea | pattern | reference */
  usageType: string | null
  /** From **Tags:** field — e.g. ['frontend', 'backend', 'ai'] */
  tags: string[]
}

export interface StudyReport {
  repoName: string
  folderName: string
  date: string | null
  deepScore: number | null
  recommendation: 'adopt' | 'watch' | 'skip' | null
  stack: string[]
  /** Which analysis files exist: overview, frontend, backend, infra, patterns, verdict */
  files: string[]
  candidateFilename: string | null
}

export interface LibraryItem {
  name: string
  filename: string
  path: string
  category: string
  content: string
}

export interface SubagentInfo {
  name: string
  displayName: string
  role: string
  learningsCount: number
  recentLearnings: string[]
}

export interface DashboardStats {
  totalCandidates: number
  totalLibraryItems: number
  totalSubagents: number
  lastRunDate: string | null
}

export interface NicheInfo {
  name: string
  keywords: string[]
}

export interface RunReport {
  filename: string
  date: string
  time: string
  displayDate: string
  totalFound: number
  uniqueAfterDedup: number
  accepted: number
  cardsWritten: number
  niches: NicheInfo[]
  durationSeconds: number | null
}

// ─── Blueprints ───────────────────────────────────────────────────────────────

export interface BlueprintCard {
  filename: string
  path: string
  title: string
  status: 'draft' | 'active' | 'shipped' | null
  createdAt: string | null
  description: string
  content: string
}

// ─── Queue ────────────────────────────────────────────────────────────────────

export type QueueStatus = 'pending' | 'processing' | 'done' | 'failed'
export type CommandType = 'blueprint' | 'study' | 'match' | 'research'

export interface QueueCommand {
  id: string
  type: CommandType
  status: QueueStatus
  created_by: string
  created_at: string
  payload: Record<string, unknown>
  // Done-specific
  completed_at?: string
  summary?: string
  artifact_count?: number
  // Failed-specific
  error_message?: string
  // Raw JSON for modal
  raw: string
}

// ─── Telemetry ────────────────────────────────────────────────────────────────

export interface AgentRunEntry {
  ts: string
  agent: string
  task_id?: string
  citations_ok: boolean
  missing_citations?: boolean
  learnings_read?: string[]
  learnings_used?: string[]
  library_read?: string[]
  library_used?: string[]
  notes?: string
}
