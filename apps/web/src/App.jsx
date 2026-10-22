import {lazy, Suspense} from 'react';
import {useRoute} from './lib/router.jsx';
import Landing from './landing/Landing.jsx';

const Console = lazy(() => import('./console/Console.jsx'));
const Docs = lazy(() => import('./docs/Docs.jsx'));
const Verify = lazy(() => import('./docs/Verify.jsx'));
const Lab = lazy(() => import('./lab/Lab.jsx'));

export default function App() {
  const path = useRoute();
  let page;
  if (path.startsWith('/app')) page = <Console path={path} />;
  else if (path.startsWith('/docs')) page = <Docs />;
  else if (path.startsWith('/verify')) page = <Verify />;
  else if (path.startsWith('/lab')) page = <Lab />;
  else page = <Landing />;
  return <Suspense fallback={<div className="boot" aria-busy="true" />}>{page}</Suspense>;
}
