import {useEffect, useRef} from 'react';

/** Headline that rises word by word when it enters the viewport. */
export function Words({children, as: Tag = 'span', className = ''}) {
  const text = String(children);
  return (
    <Tag className={`words ${className}`} aria-label={text}>
      {text.split(' ').map((w, i) => (
        <span className="w" key={i} aria-hidden="true"><span style={{'--i': i}}>{w}&nbsp;</span></span>
      ))}
    </Tag>
  );
}

/** Adds `.in` to every `.rise`, `.words` and `.draw` once it is on screen. */
export function useReveal(dep) {
  useEffect(() => {
    if (!dep) return undefined;
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), {threshold: 0.2, rootMargin: '0px 0px -6% 0px'});
    document.querySelectorAll('.rise, .words, .draw').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [dep]);
}

export function Counter({to, suffix = '', prefix = ''}) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now(), dur = 1400;
      const tick = now => {
        const p = Math.min((now - t0) / dur, 1), eased = 1 - Math.pow(1 - p, 4);
        el.textContent = prefix + Math.round(to * eased) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, {threshold: 0.6});
    io.observe(el);
    return () => io.disconnect();
  }, [to, suffix, prefix]);
  return <span ref={ref}>{prefix}0{suffix}</span>;
}
