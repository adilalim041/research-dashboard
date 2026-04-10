import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { HomePage } from '@/pages/HomePage'
import { CandidatesPage } from '@/pages/CandidatesPage'
import { CandidateDetailPage } from '@/pages/CandidateDetailPage'
import { LibraryPage } from '@/pages/LibraryPage'
import { AgentsPage } from '@/pages/AgentsPage'
import { MapPage } from '@/pages/MapPage'

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
          <Route path="/map" element={<MapPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
