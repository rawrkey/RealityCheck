import { useEffect, useState } from 'react'
import LandingPage from './pages/LandingPage'
import CallWorkspace from './pages/CallWorkspace'
import DebriefPage from './pages/DebriefPage'
import RealityPage from './pages/RealityPage'

function useHashPath(): string {
  const [path, setPath] = useState(() => (window.location.hash || '#/').slice(1))

  useEffect(() => {
    const onHashChange = () => setPath((window.location.hash || '#/').slice(1))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return path
}

const CALL_ROUTE = /^\/calls\/([^/]+)\/(debrief|reality)$/

function App() {
  const path = useHashPath()
  const [inWorkspace, setInWorkspace] = useState(false)

  const match = path.match(CALL_ROUTE)
  if (match && match[2] === 'debrief') {
    const callId = decodeURIComponent(match[1])
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <DebriefPage
          callId={callId}
          onBack={() => {
            window.location.hash = '#/'
          }}
          onReality={() => {
            window.location.hash = `#/calls/${callId}/reality`
          }}
        />
      </div>
    )
  }

  if (match && match[2] === 'reality') {
    const callId = decodeURIComponent(match[1])
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <RealityPage
          callId={callId}
          onBack={() => {
            window.location.hash = '#/'
          }}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {inWorkspace ? (
        <CallWorkspace onBack={() => setInWorkspace(false)} />
      ) : (
        <LandingPage onStartDemo={() => setInWorkspace(true)} />
      )}
    </div>
  )
}

export default App