import { Shell } from './components/Shell'
import LandingPage from './pages/LandingPage'
import CallWorkspace from './pages/CallWorkspace'
import DebriefPage from './pages/DebriefPage'
import RealityPage from './pages/RealityPage'
import { navigate, useHashPath } from './lib/router'

const CALL_ROUTE = /^\/calls\/([^/]+)\/(debrief|reality)$/

function App() {
  const path = useHashPath()
  const match = path.match(CALL_ROUTE)

  let page
  if (match && match[2] === 'debrief') {
    const callId = decodeURIComponent(match[1])
    page = (
      <DebriefPage
        callId={callId}
        onBack={() => navigate('/calls')}
        onReality={() => navigate(`/calls/${callId}/reality`)}
      />
    )
  } else if (match && match[2] === 'reality') {
    const callId = decodeURIComponent(match[1])
    page = <RealityPage callId={callId} onBack={() => navigate('/calls')} />
  } else if (path === '/calls') {
    page = <CallWorkspace onBack={() => navigate('/')} />
  } else {
    page = <LandingPage onStartDemo={() => navigate('/calls')} />
  }

  return <Shell>{page}</Shell>
}

export default App