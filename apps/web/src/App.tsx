import { useState } from 'react'
import LandingPage from './pages/LandingPage'
import CallWorkspace from './pages/CallWorkspace'

function App() {
  const [view, setView] = useState<'landing' | 'workspace'>('landing')

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {view === 'landing' ? (
        <LandingPage onStartDemo={() => setView('workspace')} />
      ) : (
        <CallWorkspace onBack={() => setView('landing')} />
      )}
    </div>
  )
}

export default App