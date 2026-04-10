import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { Delaunay } from 'd3-delaunay'
import { useNavigate } from 'react-router-dom'
import type { CandidateCard, NicheInfo } from '@/types'

// --- Types ---

type DepthLevel = 'deep' | 'explored' | 'scouted' | 'unknown'

interface Territory {
  id: string
  name: string
  displayName: string
  candidates: CandidateCard[]
  count: number
  avgScore: number
  depth: DepthLevel
  x: number
  y: number
}

interface VoronoiTerritory extends Territory {
  path: string
  cx: number
  cy: number
  area: number
}

// --- Constants ---

const DEPTH_COLORS: Record<DepthLevel, { fill: string; fillHover: string; label: string }> = {
  deep:     { fill: '#059669', fillHover: '#10b981', label: 'Глубоко изучено' },
  explored: { fill: '#2563eb', fillHover: '#3b82f6', label: 'Исследовано' },
  scouted:  { fill: '#d97706', fillHover: '#f59e0b', label: 'Разведано' },
  unknown:  { fill: '#374151', fillHover: '#4b5563', label: 'Не исследовано' },
}

// Niches known to have library entries (deep exploration)
const DEEP_NICHES = new Set([
  'frontend-ui', 'ai-tools', 'python-tools', 'backend-libs',
])

// Full map of GitHub territory — everything that could be explored
// Organized in thematic clusters
const ALL_TERRITORIES: { name: string; cluster: string }[] = [
  // Web & Frontend
  { name: 'frontend-ui', cluster: 'web' },
  { name: 'web-frameworks', cluster: 'web' },
  { name: 'css-tools', cluster: 'web' },
  { name: 'design-systems', cluster: 'web' },
  { name: 'animation-libs', cluster: 'web' },
  { name: 'state-management', cluster: 'web' },
  // Backend & APIs
  { name: 'backend-libs', cluster: 'backend' },
  { name: 'api-gateways', cluster: 'backend' },
  { name: 'auth-libs', cluster: 'backend' },
  { name: 'messaging-queues', cluster: 'backend' },
  { name: 'web-servers', cluster: 'backend' },
  { name: 'graphql-tools', cluster: 'backend' },
  // Data & Storage
  { name: 'databases', cluster: 'data' },
  { name: 'orm-libs', cluster: 'data' },
  { name: 'search-engines', cluster: 'data' },
  { name: 'caching-tools', cluster: 'data' },
  { name: 'data-pipelines', cluster: 'data' },
  // AI & ML
  { name: 'ai-tools', cluster: 'ai' },
  { name: 'ai-new', cluster: 'ai' },
  { name: 'llm-frameworks', cluster: 'ai' },
  { name: 'ml-ops', cluster: 'ai' },
  { name: 'vector-databases', cluster: 'ai' },
  { name: 'ai-agents', cluster: 'ai' },
  { name: 'ai-reliability', cluster: 'ai' },
  // DevOps & Infra
  { name: 'devops-infra', cluster: 'devops' },
  { name: 'ci-cd', cluster: 'devops' },
  { name: 'containerization', cluster: 'devops' },
  { name: 'monitoring', cluster: 'devops' },
  { name: 'edge-computing', cluster: 'devops' },
  { name: 'serverless', cluster: 'devops' },
  // Content & Media
  { name: 'content-media', cluster: 'content' },
  { name: 'content-automation', cluster: 'content' },
  { name: 'cms-headless', cluster: 'content' },
  { name: 'video-tools', cluster: 'content' },
  { name: 'image-processing', cluster: 'content' },
  // Python ecosystem
  { name: 'python-tools', cluster: 'python' },
  { name: 'python-agents', cluster: 'python' },
  { name: 'python-web', cluster: 'python' },
  { name: 'python-data', cluster: 'python' },
  // SaaS & Business
  { name: 'saas-boilerplate', cluster: 'saas' },
  { name: 'payment-tools', cluster: 'saas' },
  { name: 'crm-systems', cluster: 'saas' },
  { name: 'email-tools', cluster: 'saas' },
  { name: 'analytics-tools', cluster: 'saas' },
  // Messaging & Bots
  { name: 'whatsapp-tools', cluster: 'messaging' },
  { name: 'telegram-bots', cluster: 'messaging' },
  { name: 'discord-bots', cluster: 'messaging' },
  { name: 'chatbot-frameworks', cluster: 'messaging' },
  // Trending & Discovery
  { name: 'trending-github', cluster: 'trending' },
  { name: 'trending-tools', cluster: 'trending' },
  { name: 'hn-trending', cluster: 'trending' },
  // Security
  { name: 'security-tools', cluster: 'security' },
  { name: 'encryption-libs', cluster: 'security' },
  { name: 'vulnerability-scanners', cluster: 'security' },
  // Other domains
  { name: 'mobile-dev', cluster: 'other' },
  { name: 'gamedev', cluster: 'other' },
  { name: 'blockchain', cluster: 'other' },
  { name: 'iot-embedded', cluster: 'other' },
  { name: 'cli-tools', cluster: 'other' },
  { name: 'testing-tools', cluster: 'other' },
  { name: 'data-viz', cluster: 'other' },
  { name: 'low-code', cluster: 'other' },
]

// Cluster center positions (normalized 0-1, will be scaled to canvas)
const CLUSTER_CENTERS: Record<string, [number, number]> = {
  web:       [0.20, 0.25],
  backend:   [0.40, 0.20],
  data:      [0.60, 0.15],
  ai:        [0.50, 0.45],
  devops:    [0.75, 0.30],
  content:   [0.25, 0.55],
  python:    [0.40, 0.65],
  saas:      [0.15, 0.75],
  messaging: [0.30, 0.85],
  trending:  [0.55, 0.75],
  security:  [0.80, 0.55],
  other:     [0.80, 0.80],
}

// --- Helpers ---

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function determineDepth(niche: string, candidateCount: number, avgScore: number): DepthLevel {
  if (DEEP_NICHES.has(niche)) return 'deep'
  if (candidateCount >= 2 && avgScore >= 6) return 'explored'
  if (candidateCount > 0) return 'scouted'
  return 'unknown'
}

// Virtual canvas size (we render larger than viewport, zoom into it)
const CANVAS_W = 1800
const CANVAS_H = 1200

function buildTerritories(
  candidates: CandidateCard[],
  niches: NicheInfo[]
): Territory[] {
  // Group candidates by niche
  const nicheMap = new Map<string, CandidateCard[]>()
  for (const c of candidates) {
    const niche = c.niche && c.niche !== 'unknown' ? c.niche : null
    if (niche) {
      if (!nicheMap.has(niche)) nicheMap.set(niche, [])
      nicheMap.get(niche)!.push(c)
    }
  }

  // Add niches from run reports
  for (const n of niches) {
    if (!nicheMap.has(n.name)) nicheMap.set(n.name, [])
  }

  const territories: Territory[] = []
  const padding = 40

  for (const terrDef of ALL_TERRITORIES) {
    const { name, cluster } = terrDef
    const cands = nicheMap.get(name) || []
    const isSearched = nicheMap.has(name) || niches.some(n => n.name === name)

    // Position: cluster center + jitter
    const [clusterX, clusterY] = CLUSTER_CENTERS[cluster] || [0.5, 0.5]
    const seed = name.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
    const rng = seededRandom(seed)
    const jitterX = (rng() - 0.5) * 0.12
    const jitterY = (rng() - 0.5) * 0.12

    const x = Math.max(padding, Math.min(CANVAS_W - padding, (clusterX + jitterX) * CANVAS_W))
    const y = Math.max(padding, Math.min(CANVAS_H - padding, (clusterY + jitterY) * CANVAS_H))

    const scores = cands.map(c => c.score).filter((s): s is number => s !== null)
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    const depth = isSearched
      ? determineDepth(name, cands.length, avgScore)
      : 'unknown' as DepthLevel

    territories.push({
      id: name,
      name,
      displayName: name.replace(/-/g, ' '),
      candidates: cands,
      count: cands.length,
      avgScore,
      depth,
      x,
      y,
    })
  }

  return territories
}

function getCentroid(pathStr: string): [number, number] {
  const coords: [number, number][] = []
  const matches = pathStr.matchAll(/(-?\d+\.?\d*),(-?\d+\.?\d*)/g)
  for (const m of matches) {
    coords.push([parseFloat(m[1]), parseFloat(m[2])])
  }
  if (coords.length === 0) return [0, 0]
  const cx = coords.reduce((s, c) => s + c[0], 0) / coords.length
  const cy = coords.reduce((s, c) => s + c[1], 0) / coords.length
  return [cx, cy]
}

function getPolygonArea(pathStr: string): number {
  const coords: [number, number][] = []
  const matches = pathStr.matchAll(/(-?\d+\.?\d*),(-?\d+\.?\d*)/g)
  for (const m of matches) {
    coords.push([parseFloat(m[1]), parseFloat(m[2])])
  }
  if (coords.length < 3) return 0
  let area = 0
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length
    area += coords[i][0] * coords[j][1]
    area -= coords[j][0] * coords[i][1]
  }
  return Math.abs(area) / 2
}

// --- Zoom/Pan state ---

interface ViewState {
  x: number
  y: number
  scale: number
}

const MIN_SCALE = 0.4
const MAX_SCALE = 3.0
const INITIAL_SCALE = 0.7

// --- Component ---

interface Props {
  candidates: CandidateCard[]
  niches: NicheInfo[]
}

export function ResearchMap({ candidates, niches }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 900, height: 500 })
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [view, setView] = useState<ViewState>({
    x: CANVAS_W * 0.5,
    y: CANVAS_H * 0.5,
    scale: INITIAL_SCALE,
  })
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const navigate = useNavigate()

  // Measure container
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      setContainerSize({
        width: Math.max(rect.width, 400),
        height: Math.max(rect.height, 400),
      })
    }
    measure()
    const obs = new ResizeObserver(() => measure())
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const { width: cw, height: ch } = containerSize

  const territories = useMemo(
    () => buildTerritories(candidates, niches),
    [candidates, niches]
  )

  const voronoiData = useMemo<VoronoiTerritory[] | null>(() => {
    if (territories.length === 0) return null
    const points = territories.map(t => [t.x, t.y] as [number, number])
    const delaunay = Delaunay.from(points)
    const voronoi = delaunay.voronoi([0, 0, CANVAS_W, CANVAS_H])

    return territories.map((t, i) => {
      const cellPath = voronoi.renderCell(i)
      const [cx, cy] = getCentroid(cellPath)
      const area = getPolygonArea(cellPath)
      return { ...t, path: cellPath, cx, cy, area }
    })
  }, [territories])

  // Zoom with mouse wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
    setView(v => ({
      ...v,
      scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.scale * factor)),
    }))
  }, [])

  // Pan with mouse drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    setIsPanning(true)
    panStart.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }
  }, [view.x, view.y])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning || !panStart.current) return
    const dx = (e.clientX - panStart.current.x) / view.scale
    const dy = (e.clientY - panStart.current.y) / view.scale
    setView(v => ({
      ...v,
      x: panStart.current!.vx - dx,
      y: panStart.current!.vy - dy,
    }))
  }, [isPanning, view.scale])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
    panStart.current = null
  }, [])

  const handleClick = useCallback((territory: Territory) => {
    if (isPanning) return
    if (territory.depth === 'unknown') return
    navigate(`/candidates?niche=${encodeURIComponent(territory.name)}`)
  }, [navigate, isPanning])

  // Zoom controls
  const zoomIn = () => setView(v => ({ ...v, scale: Math.min(MAX_SCALE, v.scale * 1.3) }))
  const zoomOut = () => setView(v => ({ ...v, scale: Math.max(MIN_SCALE, v.scale / 1.3) }))
  const zoomFit = () => setView({ x: CANVAS_W * 0.5, y: CANVAS_H * 0.5, scale: INITIAL_SCALE })

  // Compute SVG viewBox from view state
  const vbW = cw / view.scale
  const vbH = ch / view.scale
  const vbX = view.x - vbW / 2
  const vbY = view.y - vbH / 2

  // Determine label visibility based on zoom
  const labelMinArea = 2000 / (view.scale * view.scale) // show more labels when zoomed in

  const hoveredTerritory = voronoiData?.find(t => t.id === hoveredId) ?? null

  return (
    <div
      ref={containerRef}
      className="relative select-none"
      style={{ height: '65vh', minHeight: 450 }}
    >
      <svg
        width={cw}
        height={ch}
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        className="w-full h-full"
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          {/* Organic border filter */}
          <filter id="organic" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.015"
              numOctaves={4}
              seed={42}
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale={6}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>

          {/* Fog pattern for unknown territories */}
          <pattern id="fog" patternUnits="userSpaceOnUse" width="8" height="8">
            <rect width="8" height="8" fill="#1e293b" />
            <circle cx="4" cy="4" r="1.5" fill="#334155" opacity="0.4" />
          </pattern>
        </defs>

        {/* Ocean background */}
        <rect x={-100} y={-100} width={CANVAS_W + 200} height={CANVAS_H + 200} fill="#0c1222" />

        {/* Territory cells with organic edges */}
        <g filter="url(#organic)">
          {voronoiData?.map(t => {
            const isHovered = hoveredId === t.id
            const colors = DEPTH_COLORS[t.depth]
            const fill = t.depth === 'unknown'
              ? 'url(#fog)'
              : isHovered ? colors.fillHover : colors.fill

            return (
              <path
                key={t.id}
                d={t.path}
                fill={fill}
                fillOpacity={t.depth === 'unknown' ? 0.3 : isHovered ? 0.85 : 0.55}
                stroke="#0c1222"
                strokeWidth={isHovered ? 4 : 2.5}
                className={t.depth !== 'unknown' ? 'cursor-pointer' : 'cursor-default'}
                style={{ transition: 'fill-opacity 0.15s' }}
                onMouseEnter={() => setHoveredId(t.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => handleClick(t)}
              />
            )
          })}
        </g>

        {/* Labels — visibility depends on zoom level and cell area */}
        {voronoiData?.map(t => {
          const isHovered = hoveredId === t.id
          const showLabel = isHovered || t.area > labelMinArea
          if (!showLabel) return null

          // Scale font size based on depth and area
          const baseFontSize = t.depth === 'unknown' ? 14 : 16
          const fontSize = isHovered ? baseFontSize + 3 : baseFontSize

          return (
            <g key={`label-${t.id}`} className="pointer-events-none">
              {/* Shadow background for readability */}
              <text
                x={t.cx}
                y={t.cy - (t.count > 0 ? 10 : 0)}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="black"
                fontSize={fontSize}
                fontWeight={700}
                stroke="black"
                strokeWidth={3}
                opacity={0.5}
              >
                {t.displayName}
              </text>

              {/* Territory name */}
              <text
                x={t.cx}
                y={t.cy - (t.count > 0 ? 10 : 0)}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={t.depth === 'unknown' ? '#6b7280' : '#f1f5f9'}
                fontSize={fontSize}
                fontWeight={isHovered ? 700 : 600}
              >
                {t.displayName}
              </text>

              {/* Count badge */}
              {t.count > 0 && (
                <>
                  <text
                    x={t.cx}
                    y={t.cy + 12}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="black"
                    fontSize={13}
                    fontFamily="monospace"
                    stroke="black"
                    strokeWidth={3}
                    opacity={0.4}
                  >
                    {t.count} repos {t.avgScore > 0 ? `avg ${t.avgScore.toFixed(1)}` : ''}
                  </text>
                  <text
                    x={t.cx}
                    y={t.cy + 12}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#cbd5e1"
                    fontSize={13}
                    fontFamily="monospace"
                  >
                    {t.count} repos {t.avgScore > 0 ? `avg ${t.avgScore.toFixed(1)}` : ''}
                  </text>
                </>
              )}

              {/* "?" for unknown */}
              {t.depth === 'unknown' && (
                <text
                  x={t.cx}
                  y={t.cy + 12}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#4b5563"
                  fontSize={12}
                >
                  ???
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* Zoom controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-1 z-10">
        <button
          onClick={zoomIn}
          className="bg-card border border-border rounded-lg w-9 h-9 flex items-center justify-center text-lg font-bold hover:bg-muted transition-colors"
        >
          +
        </button>
        <button
          onClick={zoomOut}
          className="bg-card border border-border rounded-lg w-9 h-9 flex items-center justify-center text-lg font-bold hover:bg-muted transition-colors"
        >
          -
        </button>
        <button
          onClick={zoomFit}
          className="bg-card border border-border rounded-lg w-9 h-9 flex items-center justify-center text-xs font-bold hover:bg-muted transition-colors mt-1"
          title="Показать всё"
        >
          Fit
        </button>
      </div>

      {/* Zoom level indicator */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-card/80 backdrop-blur-sm border border-border rounded-lg px-3 py-1 z-10">
        <span className="text-xs text-muted-foreground font-mono">
          {Math.round(view.scale * 100)}%
        </span>
      </div>

      {/* Hover tooltip */}
      {hoveredTerritory && hoveredTerritory.depth !== 'unknown' && (
        <div
          className="absolute bg-card border border-border rounded-lg p-3 max-w-xs pointer-events-none z-10 shadow-xl"
          style={{ top: 16, left: 16 }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: DEPTH_COLORS[hoveredTerritory.depth].fill }}
            />
            <h3 className="font-bold text-sm">{hoveredTerritory.displayName}</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            {DEPTH_COLORS[hoveredTerritory.depth].label}
          </p>
          {hoveredTerritory.count > 0 ? (
            <div className="space-y-1">
              {hoveredTerritory.candidates.slice(0, 5).map(c => (
                <div key={c.filename} className="flex items-center gap-2 text-xs">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: DEPTH_COLORS[hoveredTerritory.depth].fillHover }}
                  />
                  <span className="truncate">{c.name}</span>
                  {c.score && (
                    <span className="font-mono text-accent ml-auto shrink-0">{c.score}</span>
                  )}
                </div>
              ))}
              {hoveredTerritory.count > 5 && (
                <p className="text-xs text-muted-foreground">
                  +{hoveredTerritory.count - 5} ещё...
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Ниша в поиске, находок пока нет</p>
          )}
          {hoveredTerritory.count > 0 && (
            <p className="text-xs text-blue-400 mt-2">Клик → список кандидатов</p>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm border border-border rounded-lg p-3 z-10">
        <p className="text-xs font-semibold text-muted-foreground mb-2">Глубина исследования</p>
        <div className="space-y-1.5">
          {(Object.entries(DEPTH_COLORS) as [DepthLevel, typeof DEPTH_COLORS[DepthLevel]][]).map(([key, val]) => (
            <div key={key} className="flex items-center gap-2 text-xs">
              <span
                className="w-3 h-3 rounded-sm inline-block"
                style={{
                  backgroundColor: key === 'unknown' ? '#374151' : val.fill,
                  opacity: key === 'unknown' ? 0.5 : 0.7,
                }}
              />
              <span className="text-muted-foreground">{val.label}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2 opacity-70">
          Scroll = zoom, drag = pan
        </p>
      </div>
    </div>
  )
}
