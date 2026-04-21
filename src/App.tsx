import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { HomePage } from '@/pages/HomePage'
import { CandidatesPage } from '@/pages/CandidatesPage'
import { CandidateDetailPage } from '@/pages/CandidateDetailPage'
import { LibraryPage } from '@/pages/LibraryPage'
import { AgentsPage } from '@/pages/AgentsPage'
import { MapPage } from '@/pages/MapPage'
import { StudiesPage } from '@/pages/StudiesPage'
import { BlueprintsPage } from '@/pages/BlueprintsPage'
import { QueuePage } from '@/pages/QueuePage'
import { TelemetryPage } from '@/pages/TelemetryPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/candidates" element={<CandidatesPage />} />
          <Route path="/candidates/:filename" element={<CandidateDetailPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/studies" element={<StudiesPage />} />
          <Route path="/blueprints" element={<BlueprintsPage />} />
          <Route path="/queue" element={<QueuePage />} />
          <Route path="/telemetry" element={<TelemetryPage />} />
          <Route path="/map" element={<MapPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
