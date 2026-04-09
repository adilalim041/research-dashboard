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
