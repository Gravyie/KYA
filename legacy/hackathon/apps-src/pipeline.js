// src/pipeline.js
import { fetch } from 'undici';
import * as cheerio from 'cheerio';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function isBlockedHost(hostname) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '169.254.169.254' || // Cloud metadata IP
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.')
  );
}

export async function scrapeUrl(rawUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Only HTTP/HTTPS protocols are supported');
  }

  if (isBlockedHost(parsedUrl.hostname)) {
    throw new Error('Restricted host address');
  }

  const response = await fetch(parsedUrl.href, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    signal: AbortSignal.timeout(10000), // 10s timeout protection
  });

  if (!response.ok) {
    throw new Error(`Upstream returned ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Drop scripts, styles, and SVGs to clean the text extraction
  $('script, style, noscript, svg').remove();

  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('title').text().trim() ||
    '';

  const description =
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    '';

  const image =
    $('meta[property="og:image"]').attr('content') ||
    $('meta[name="twitter:image"]').attr('content') ||
    '';

  const headings = $('h1, h2')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);

  const rawBodyText = $('article, main, body')
    .first()
    .text()
    .replace(/\s+/g, ' ')
    .trim();

  return {
    url: parsedUrl.href,
    title,
    description,
    image,
    headings,
    content: rawBodyText.slice(0, 5000), // Trimmed snippet
  };
}
