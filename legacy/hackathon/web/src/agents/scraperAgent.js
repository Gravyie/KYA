import * as cheerio from 'cheerio';

export async function scrapeUrl(targetUrl) {
  try {
    const url = targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`;

    // 1. Fetch raw HTML
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    // 2. Parse HTML with Cheerio
    const $ = cheerio.load(html);

    // 3. Remove non-content elements
    $('script, style, nav, footer, header, aside, noscript, iframe').remove();

    const title = $('title').text().trim() || 'No title found';

    // 4. Extract readable text from main elements
    const contentNode = $('article').length
      ? $('article')
      : $('main').length
      ? $('main')
      : $('body');

    const cleanText = contentNode
      .text()
      .replace(/\s\s+/g, ' ')
      .trim();

    return {
      success: true,
      title,
      url,
      content: cleanText.slice(0, 3000), // Truncate to avoid UI bloat
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}