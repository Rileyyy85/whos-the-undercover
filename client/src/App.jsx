import { Routes, Route, Link } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import Rules from './pages/Rules.jsx';
import Setup from './pages/Setup.jsx';
import Join from './pages/Join.jsx';
import Host from './pages/Host.jsx';
import Player from './pages/Player.jsx';

function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div>
        <p className="text-6xl mb-4">🕵️</p>
        <h1 className="text-3xl font-bold mb-2">Page not found</h1>
        <Link to="/" className="text-civilian underline text-lg">Back to the start</Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/rules" element={<Rules />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/join" element={<Join />} />
      <Route path="/room/:code/host" element={<Host />} />
      <Route path="/room/:code/player" element={<Player />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
