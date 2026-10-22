import {useEffect, useState} from 'react';
import {renderChrome} from './chromeText.js';
import '@fontsource/sacramento/400.css';

const cache = new Map();
const bake = (text, tube) => {
  const key = text + tube;
  if (!cache.has(key)) {
    cache.set(key, new Promise(res => {
      const go = () => renderChrome(text, {font: 'Sacramento', size: 400, tube}).then(res, () => res(null));
      ('requestIdleCallback' in window ? requestIdleCallback : setTimeout)(go, {timeout: 600});
    }));
  }
  return cache.get(key);
};

/**
 * Liquid-chrome script lettering. Plain text is shown immediately (same font, same size), then the baked chrome
 * fades in over it. A sheen sweeps across the chrome, masked to the letters, every few seconds.
 */
export default function ChromeWord({text, tube = 28, as: Tag = 'span', className = ''}) {
  const [art, setArt] = useState(null);
  useEffect(() => { let live = true; bake(text, tube).then(a => { if (live) setArt(a); }); return () => { live = false; }; }, [text, tube]);
  return (
    <Tag className={`chrome-word ${art ? 'ready' : ''} ${className}`} aria-label={text.replace('\n', ' ')}
      style={art ? {'--chrome': `url(${art.url})`, aspectRatio: `${art.width} / ${art.height}`} : undefined}>
      <span className="cw-text" aria-hidden="true">{text.split('\n').map((l, i) => <span key={i}>{l}</span>)}</span>
      {art && <img className="cw-img" src={art.url} alt="" draggable="false" decoding="async" />}
      {art && <i className="cw-sheen" aria-hidden="true" />}
    </Tag>
  );
}
