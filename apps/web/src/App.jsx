import {lazy, Suspense} from 'react';
import {useRoute} from './lib/router.jsx';
import {Link} from './lib/router.jsx';
import {Logo} from './components/ui.jsx';

const Landing = lazy(() => import('./landing/Landing.jsx'));
const Console = lazy(() => import('./console/Console.jsx'));
const Docs = lazy(() => import('./docs/Docs.jsx'));
const Verify = lazy(() => import('./docs/Verify.jsx'));

export default function App() {
  const path = useRoute();
  let page;
  if (path === '/app' || path.startsWith('/app/')) page = <Console path={path} />;
  else if (path === '/docs') page = <Docs />;
  else if (path === '/verify') page = <Verify />;
  else if (path === '/') page = <Landing />;
  else page = <main className="route-message"><Logo /><p className="eyebrow">404 · Page not found</p><h1>This route ends here.</h1><p>The console and documentation are a step away.</p><div className="actions"><Link to="/" className="btn">Back to the site</Link><Link to="/app" className="btn ghost">Open console</Link></div></main>;
  return <Suspense fallback={<div className="route-message" role="status" aria-busy="true"><Logo /><p>Opening Wardrail…</p></div>}>{page}</Suspense>;
}
