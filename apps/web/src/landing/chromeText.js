/*
 * Liquid-chrome lettering, baked once to an image.
 *
 * A monoline script is stroked thick with round joins so every letter is a tube of even width. The tube's height
 * profile comes from blurring that mask; its normals are lit against a synthwave studio (white horizon line,
 * lilac sky, violet floor, a cool blue rim). The result is a static PNG: crisp at any size via CSS, zero per-frame
 * cost, and the same artwork in the hero and the finale.
 */

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;
/** Three box-blur passes per axis ≈ a gaussian. Done by hand: ctx.filter is missing in Safari. */
function blur(src, W, H, sigma) {
  const r = Math.max(1, Math.round(Math.sqrt((12 * sigma * sigma) / 3 + 1) / 2));
  let a = src, b = new Float32Array(src.length);
  const pass = (from, to, horiz) => {
    const n = horiz ? W : H, m = horiz ? H : W, w = 2 * r + 1;
    for (let j = 0; j < m; j++) {
      const at = i => (horiz ? j * W + i : i * W + j);
      let acc = 0;
      for (let i = -r; i <= r; i++) acc += from[at(Math.min(n - 1, Math.max(0, i)))];
      for (let i = 0; i < n; i++) {
        to[at(i)] = acc / w;
        acc += from[at(Math.min(n - 1, i + r + 1))] - from[at(Math.max(0, i - r))];
      }
    }
  };
  for (let k = 0; k < 3; k++) { pass(a, b, true); pass(b, a, false); }
  return a;
}
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

function env(rx, ry) {
  // Neon studio: icy cyan-white sky, a white-hot horizon, hot magenta just below it, deep indigo underneath.
  let c;
  if (ry > 0) {
    const t = smooth(0, 0.85, ry);
    c = [mix(0.92, 0.55, t), mix(0.97, 0.9, t), mix(1, 1.05, t)];
  } else {
    const t = smooth(0.02, 0.9, -ry);
    c = [mix(1, 0.14, t), mix(0.4, 0.04, t), mix(0.9, 0.42, t)];
  }
  const hot = Math.exp(-Math.pow((ry + 0.02) * 16, 2));             // white-hot horizon line
  c[0] = mix(c[0], 1.15, hot); c[1] = mix(c[1], 1.1, hot); c[2] = mix(c[2], 1.15, hot);
  const dark = Math.exp(-Math.pow((ry + 0.13) * 20, 2));            // hard dark band under it
  c[0] = mix(c[0], 0.2, dark * 0.75); c[1] = mix(c[1], 0.05, dark * 0.75); c[2] = mix(c[2], 0.4, dark * 0.7);
  const side = smooth(0.35, 1, Math.abs(rx));                       // electric-blue sides
  c[0] = mix(c[0], 0.18, side * 0.6); c[1] = mix(c[1], 0.45, side * 0.6); c[2] = mix(c[2], 1, side * 0.6);
  return c;
}

/**
 * @param {string} text
 * @param {{font: string, size: number, tube: number, slant?: number, padding?: number}} o
 * @returns {Promise<{url: string, width: number, height: number}>}
 */
export async function renderChrome(text, {font = 'Sacramento', size = 300, tube = 30, slant = -0.08, padding = 0.18, profile} = {}) {
  await document.fonts?.load(`400 ${size}px "${font}"`).catch(() => {});
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = `400 ${size}px "${font}"`;
  const lines = text.split('\n'), lh = size * 0.98;
  const mw = Math.max(...lines.map(l => probe.measureText(l).width));
  const pad = Math.round(size * padding);
  const W = Math.ceil(mw * 1.08 + pad * 2 + tube * 2), H = Math.ceil(size * 1.35 + pad + lh * (lines.length - 1));

  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const mask = mk(), g = mask.getContext('2d');
  g.font = probe.font; g.textBaseline = 'alphabetic'; g.textAlign = 'center';
  g.lineJoin = 'round'; g.lineCap = 'round'; g.lineWidth = tube; g.fillStyle = g.strokeStyle = '#fff';
  g.translate(W / 2, size * 0.92 + pad * 0.6); g.transform(1, 0, slant, 1, 0, 0);
  lines.forEach((l, i) => { g.strokeText(l, 0, i * lh); g.fillText(l, 0, i * lh); });

  // height field: a blur of about a third of the tube width gives a rounded profile with no flat plateau
  const sigma = profile ?? Math.max(2, tube * 0.33);
  const A = g.getImageData(0, 0, W, H).data;
  const alpha = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) alpha[i] = A[i * 4] / 255;
  const Hd = blur(alpha.slice(), W, H, sigma);
  const hAt = (x, y) => Hd[y * W + x];
  const out = mk(), og = out.getContext('2d'), img = og.createImageData(W, H), o = img.data;
  const k = sigma * 2.4;                            // bump strength scales with the profile width
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = (y * W + x) * 4, a = A[i] / 255;
      if (a < 0.004) continue;
      const h = hAt(x, y);
      const nx = -(hAt(x + 1, y) - hAt(x - 1, y)) * k;
      const ny = (hAt(x, y + 1) - hAt(x, y - 1)) * k;
      const nl = Math.hypot(nx, ny, 1); const Nx = nx / nl, Ny = ny / nl, Nz = 1 / nl;
      // reflect view (0,0,-1) about N
      const rx = 2 * Nz * Nx, ry = 2 * Nz * Ny;
      let [r, gg, b] = env(rx, ry);
      // specular from a key light up-left
      const sp = Math.pow(clamp(Nx * -0.4 + Ny * 0.55 + Nz * 0.73), 40) * 1.6;
      r += sp; gg += sp; b += sp;
      // edge: deep blue rim where the tube turns away, and a dark inner contour line
      const edge = 1 - smooth(0.06, 0.4, h);
      r = mix(r, 0.06, edge * 0.92); gg = mix(gg, 0.08, edge * 0.92); b = mix(b, 0.42, edge * 0.9);
      o[i] = clamp(r) * 255; o[i + 1] = clamp(gg) * 255; o[i + 2] = clamp(b) * 255; o[i + 3] = a * 255;
    }
  }
  og.putImageData(img, 0, 0);
  const blob = await new Promise(res => out.toBlob(res, 'image/png'));
  return {url: URL.createObjectURL(blob), width: W, height: H};
}
