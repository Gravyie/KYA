/**
 * Motion primitives.
 *
 * Three rules this file exists to enforce:
 *
 * 1. EVERY animation degrades to static under `prefers-reduced-motion`. That is
 *    checked once here rather than remembered at 40 call sites.
 * 2. NO scroll listeners. `whileInView` uses IntersectionObserver under the
 *    hood, so nothing runs per-frame on the main thread.
 * 3. Motion is MOTIVATED. Each export below has a stated job:
 *      Reveal    hierarchy   content enters in reading order
 *      Stagger   sequence    a list arrives as a list, not all at once
 *      Count     feedback    a number that moved is visibly a number that moved
 *    Anything that would just be movement for its own sake is not here.
 *
 * The easing is the same curve as the CSS `--ease` token so JS-driven and
 * CSS-driven motion in the same view cannot disagree.
 */
import React, {useEffect, useRef, useState} from 'react';
import {motion, useReducedMotion, useInView} from 'motion/react';

export const EASE = [0.3, 0.8, 0.3, 1];

/** Content enters in reading order as it becomes relevant. */
export function Reveal({children, delay = 0, y = 18, className, style, as = 'div'}) {
  const reduce = useReducedMotion();
  const M = motion[as] || motion.div;
  return (
    <M
      className={className}
      style={style}
      initial={reduce ? false : {opacity: 0, y}}
      whileInView={{opacity: 1, y: 0}}
      viewport={{once: true, amount: 0.25}}
      transition={{duration: 0.62, delay, ease: EASE}}
    >
      {children}
    </M>
  );
}

/** A list arrives as a list. Children must be <Stagger.Item>. */
export function Stagger({children, className, style, delay = 0, gap = 0.06}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      style={style}
      initial="hidden"
      whileInView="shown"
      viewport={{once: true, amount: 0.2}}
      variants={{
        hidden: {},
        shown: {transition: reduce ? {} : {staggerChildren: gap, delayChildren: delay}},
      }}
    >
      {children}
    </motion.div>
  );
}

Stagger.Item = function StaggerItem({children, className, style, y = 14}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      style={style}
      variants={{
        hidden: reduce ? {} : {opacity: 0, y},
        shown: {opacity: 1, y: 0, transition: {duration: 0.5, ease: EASE}},
      }}
    >
      {children}
    </motion.div>
  );
};

/**
 * A number that changed should be seen changing.
 *
 * Deliberately NOT a motion value: reputation is a discrete on-chain fact, and
 * animating it as a smooth float would imply continuous measurement. This
 * counts through integer basis points, so what you watch is the real quantity.
 */
export function Count({value, format = (v) => String(v), duration = 900, className, style}) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    if (reduce || from.current === value) {
      setShown(value);
      from.current = value;
      return;
    }
    const start = performance.now();
    const a = from.current;
    const b = value;
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic: fast commit, gentle settle. Matches the ledger feeling of
      // a receipt landing rather than a dial being turned.
      const e = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(a + (b - a) * e));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduce]);

  return (
    <span className={className} style={style}>
      {format(shown)}
    </span>
  );
}

/** True once the element has been seen. For deferring expensive children. */
export function useSeen(amount = 0.15) {
  const ref = useRef(null);
  const seen = useInView(ref, {once: true, amount});
  return [ref, seen];
}
