import type { GitHubFile } from '@/types'
import { decodeBase64 } from '@/lib/utils'

const REPO_OWNER = 'adilalim041'
const REPO_NAME = 'ObsidianVault'
const BASE_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents`

function getHeaders(): HeadersInit {
  const token = import.meta.env.VITE_GITHUB_TOKEN
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
  }
  if (token) {
    headers['Authorization'] = `token ${token}`
  }
  return headers
}

// Two-tier cache: localStorage (persistent, 10min TTL) + in-memory (fast)
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes
const LS_CACHE_PREFIX = 'rd_cache_'

const memCache = new Map<string, { data: unknown; ts: number }>()

function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(LS_CACHE_PREFIX + key)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw) as { data: T; ts: number }
    if (Date.now() - ts > CACHE_TTL) {
      localStorage.removeItem(LS_CACHE_PREFIX + key)
      return null
    }
    return data
  } catch {
    return null
  }
}

function lsSet(key: string, data: unknown): void {
  try {
    localStorage.setItem(
      LS_CACHE_PREFIX + key,
      JSON.stringify({ data, ts: Date.now() })
    )
  } catch {
    // Storage full — clear old entries and skip
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i)
        if (k?.startsWith(LS_CACHE_PREFIX)) localStorage.removeItem(k)
      }
    } catch { /* ignore */ }
  }
}

async function fetchWithCache<T>(url: string): Promise<T> {
  // 1. Check in-memory cache
  const memCached = memCache.get(url)
  if (memCached && Date.now() - memCached.ts < CACHE_TTL) {
    return memCached.data as T
  }

  // 2. Check localStorage cache
  const lsCached = lsGet<T>(url)
  if (lsCached !== null) {
    memCache.set(url, { data: lsCached, ts: Date.now() })
    return lsCached
  }

  // 3. Fetch from network
  const res = await fetch(url, { headers: getHeaders() })
  if (!res.ok) {
    // Clear any stale cache for this URL
    memCache.delete(url)
    try { localStorage.removeItem(LS_CACHE_PREFIX + url) } catch {}
    throw new Error(`GitHub API error: ${res.status}`)
  }
  const data = await res.json()
  // Only cache valid responses (arrays or objects with expected fields)
  if (data && typeof data === 'object') {
    memCache.set(url, { data, ts: Date.now() })
    lsSet(url, data)
  }
  return data as T
}

export async function listDirectory(path: string): Promise<GitHubFile[]> {
  const url = `${BASE_URL}/${path}`
  const files = await fetchWithCache<GitHubFile[]>(url)
  return Array.isArray(files) ? files : []
}

export async function getFileContent(path: string): Promise<string> {
  const url = `${BASE_URL}/${path}`
  const file = await fetchWithCache<GitHubFile>(url)
  if (file.content && file.encoding === 'base64') {
    return decodeBase64(file.content)
  }
  throw new Error(`Cannot decode file: ${path}`)
}

export async function getCandidateFiles(): Promise<GitHubFile[]> {
  return listDirectory('research/candidates')
}

export async function getLibraryCategories(): Promise<GitHubFile[]> {
  return listDirectory('research/library')
}

export async function getLibraryCategoryFiles(category: string): Promise<GitHubFile[]> {
  const files = await listDirectory(`research/library/${category}`)
  return files.filter(f => f.name.endsWith('.md') && f.name !== '_index.md')
}

export async function getSubagentList(): Promise<GitHubFile[]> {
  return listDirectory('research/subagents')
}

export async function getSubagentFiles(name: string): Promise<GitHubFile[]> {
  return listDirectory(`research/subagents/${name}`)
}

export async function getRunFiles(): Promise<GitHubFile[]> {
  return listDirectory('research/runs')
}

export function clearCache(): void {
  memCache.clear()
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k?.startsWith(LS_CACHE_PREFIX)) localStorage.removeItem(k)
    }
  } catch { /* ignore */ }
}
