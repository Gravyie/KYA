import {useEffect, useState, useCallback} from 'react';

const EVENT = 'shuin:navigate';

export function navigate(to, {replace = false} = {}) {
  if (to === location.pathname + location.search + location.hash) return;
  history[replace ? 'replaceState' : 'pushState'](null, '', to);
  window.dispatchEvent(new Event(EVENT));
  if (!to.includes('#')) window.scrollTo({top: 0, behavior: 'instant'});
}

export function useRoute() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const sync = () => setPath(location.pathname);
    window.addEventListener('popstate', sync);
    window.addEventListener(EVENT, sync);
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener(EVENT, sync); };
  }, []);
  return path;
}

export function Link({to, children, onClick, ...rest}) {
  const handle = useCallback(e => {
    onClick?.(e);
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || rest.target) return;
    if (/^(https?:)?\/\//.test(to)) return;
    e.preventDefault();
    navigate(to);
  }, [to, onClick, rest.target]);
  return <a href={to} onClick={handle} {...rest}>{children}</a>;
}
