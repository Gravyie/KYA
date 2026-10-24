import {useEffect, useRef} from 'react';

/** Keep keyboard focus in the active dialog and return it to its trigger. */
export function useDialog(open = true, onEscape) {
  const ref = useRef(null);
  const close = useRef(onEscape); close.current = onEscape;
  useEffect(() => {
    if (!open || !ref.current) return;
    const element = ref.current, previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const controls = () => [...element.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')].filter(e => e.getClientRects().length);
    (element.querySelector('[autofocus]') || controls()[0] || element).focus();
    const key = e => {
      if (e.key === 'Escape' && close.current) { e.preventDefault(); close.current(); }
      if (e.key !== 'Tab') return;
      const items = controls(), first = items[0], last = items.at(-1);
      if (!first) { e.preventDefault(); return; }
      if (e.shiftKey && (document.activeElement === first || !element.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !element.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    element.addEventListener('keydown', key);
    return () => { element.removeEventListener('keydown', key); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, [open]);
  return ref;
}

/** Arrow/Home/End navigation for single-row tab lists. */
export function tabKeys(event) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]')];
  const index = tabs.indexOf(document.activeElement);
  if (index < 0) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  tabs[next]?.focus(); tabs[next]?.click();
}
