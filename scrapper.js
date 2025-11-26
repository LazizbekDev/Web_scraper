const axios = require('axios');
const cheerio = require('cheerio');
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36 ScrapperBot/2.0';
const SCRAPER_BASE_URL = process.env.SCRAPER_API_URL || 'https://api.scraperapi.com';
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;
const SHOULD_RENDER_JS = String(process.env.SCRAPER_RENDER_JS || '').toLowerCase() === 'true';
const DEFAULT_FETCH_MODE = SCRAPER_API_KEY ? 'service' : 'browser';
const FETCH_MODE = (process.env.SCRAPER_FETCH_MODE || DEFAULT_FETCH_MODE).toLowerCase();
const USE_BROWSER = FETCH_MODE === 'browser' || FETCH_MODE === 'hybrid';
const USE_SERVICE = FETCH_MODE === 'service' || FETCH_MODE === 'hybrid';
const BROWSER_WAIT_MS = Number(process.env.SCRAPER_BROWSER_WAIT_MS) || 0;
const BROWSER_NETWORK_IDLE = process.env.SCRAPER_BROWSER_WAIT_UNTIL || 'networkidle2';

const mdEscape = (value = '') => String(value).replace(/([_*[\]`])/g, '\\$1');
const cleanText = (value = '') => value.replace(/\s+/g, ' ').trim();
const truncate = (text, max = 160) => (text.length > max ? `${text.slice(0, max - 3)}...` : text);

async function fetchHtmlViaService(targetUrl) {
  if (!SCRAPER_API_KEY) {
    throw new Error('SCRAPER_API_KEY is missing. Add it to your environment to enable the scraping service.');
  }

  const params = {
    api_key: SCRAPER_API_KEY,
    url: targetUrl,
  };

  if (SHOULD_RENDER_JS) params.render = 'true';
  if (process.env.SCRAPER_COUNTRY_CODE) params.country_code = process.env.SCRAPER_COUNTRY_CODE;
  if (process.env.SCRAPER_DEVICE_TYPE) params.device_type = process.env.SCRAPER_DEVICE_TYPE;

  const timeout = Number(process.env.SCRAPER_TIMEOUT_MS) || 60000;

  const response = await axios.get(SCRAPER_BASE_URL, {
    params,
    headers: { 'User-Agent': DEFAULT_USER_AGENT },
    timeout,
  });

  return response.data;
}

let browserSingleton;
async function getBrowser() {
  if (browserSingleton) return browserSingleton;

  const resolvedExecutablePath = process.env.PUPPETEER_EXECUTABLE_PATH || (await chromium.executablePath());
  if (!resolvedExecutablePath) {
    throw new Error(
      'Unable to locate a Chromium executable. Set PUPPETEER_EXECUTABLE_PATH when running outside serverless-compatible environments.'
    );
  }

  browserSingleton = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport || { width: 1280, height: 720 },
    executablePath: resolvedExecutablePath,
    headless: typeof chromium.headless === 'boolean' ? chromium.headless : true,
    ignoreHTTPSErrors: true,
  });

  browserSingleton.on('disconnected', () => {
    browserSingleton = undefined;
  });

  return browserSingleton;
}

async function fetchHtmlViaBrowser(targetUrl) {
  const timeout = Number(process.env.SCRAPER_TIMEOUT_MS) || 60000;
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setUserAgent(DEFAULT_USER_AGENT);
    await page.setExtraHTTPHeaders({
      'Accept-Language': process.env.SCRAPER_ACCEPT_LANGUAGE || 'en-US,en;q=0.9',
    });

    await page.goto(targetUrl, {
      waitUntil: BROWSER_NETWORK_IDLE,
      timeout,
    });

    if (BROWSER_WAIT_MS > 0) {
      await page.waitForTimeout(BROWSER_WAIT_MS);
    }

    const html = await page.content();
    return html;
  } finally {
    try {
      await page.close();
    } catch (closeError) {
      console.warn('Failed to close Puppeteer page:', closeError.message);
    }
  }
}

async function fetchHtml(targetUrl) {
  let lastError;

  if (USE_BROWSER) {
    try {
      return await fetchHtmlViaBrowser(targetUrl);
    } catch (error) {
      lastError = error;
      if (FETCH_MODE === 'browser') throw error;
      console.warn('Browser fetch failed, falling back to service:', error.message);
    }
  }

  if (USE_SERVICE) {
    return fetchHtmlViaService(targetUrl);
  }

  throw lastError || new Error('No fetch mode enabled. Set SCRAPER_FETCH_MODE to service, browser, or hybrid.');
}

function buildHeadingsSummary($) {
  const sections = [];
  for (let level = 1; level <= 3; level += 1) {
    const texts = $(`h${level}`)
      .map((_, el) => cleanText($(el).text()))
      .get()
      .filter(Boolean);
    const preview = texts.slice(0, 3).map((text) => mdEscape(truncate(text, 120))).join(' | ');
    sections.push(
      `- H${level} (${texts.length || 0}): ${preview || 'None discovered'}${texts.length > 3 ? ` (+${texts.length - 3} more)` : ''}`
    );
  }
  return sections;
}

function buildParagraphPreview($) {
  const paragraphs = $('p')
    .map((_, el) => cleanText($(el).text()))
    .get()
    .filter((text) => text.length >= 60)
    .slice(0, 2)
    .map((text, idx) => `- Para ${idx + 1}: ${mdEscape(truncate(text, 240))}`);

  return paragraphs.length ? paragraphs : ['- No substantial paragraphs detected.'];
}

function buildLinkSummary($, baseUrl) {
  const stats = { total: 0, internal: 0, external: 0, samples: [] };

  let hostname;
  try {
    hostname = new URL(baseUrl).hostname;
  } catch (_) {
    hostname = null;
  }

  $('a[href]').each((_, el) => {
    const rawHref = $(el).attr('href');
    if (!rawHref || rawHref.startsWith('#') || rawHref.toLowerCase().startsWith('javascript')) return;

    let linkUrl;
    try {
      linkUrl = new URL(rawHref, baseUrl);
    } catch (_) {
      return;
    }

    const text = cleanText($(el).text()) || linkUrl.href;
    stats.total += 1;
    if (hostname && linkUrl.hostname === hostname) stats.internal += 1;
    else stats.external += 1;

    if (stats.samples.length < 5) {
      stats.samples.push(`  - ${mdEscape(truncate(text, 80))} → ${mdEscape(linkUrl.href)}`);
    }
  });

  return [
    `- Total links: ${stats.total} (internal ${stats.internal} / external ${stats.external})`,
    ...(stats.samples.length ? ['- Sample links:', ...stats.samples] : ['- No crawlable links discovered.']),
  ];
}

function buildImageSummary($) {
  const images = $('img');
  const total = images.length;
  const withAlt = images.filter((_, el) => Boolean(cleanText($(el).attr('alt') || ''))).length;
  const withoutAlt = total - withAlt;

  return [
    `- Total images: ${total}`,
    `- With alt text: ${withAlt}`,
    `- Missing alt text: ${withoutAlt}`,
  ];
}

async function scrapeUrl(url) {
  if (!url) throw new Error('Please provide a URL to scrape.');

  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    const title = cleanText($('title').first().text()) || 'No title found';
    const metaDescription = cleanText($('meta[name="description"]').attr('content') || '') || 'No meta description found.';
    const metaKeywords = cleanText($('meta[name="keywords"]').attr('content') || '') || 'No meta keywords found.';
    const ogTitle = cleanText($('meta[property="og:title"]').attr('content') || '') || 'Not provided';
    const ogDescription = cleanText($('meta[property="og:description"]').attr('content') || '') || 'Not provided';
    const canonical = $('link[rel="canonical"]').attr('href') || 'Not declared';
    const lang = $('html').attr('lang') || 'Not specified';
    const robots = cleanText($('meta[name="robots"]').attr('content') || '') || 'Not declared';
    const wordCount = cleanText($('body').text()).split(' ').filter(Boolean).length;
    const structuredDataBlocks = $('script[type="application/ld+json"]').length;
    const lastUpdated =
      $('meta[property="article:modified_time"]').attr('content') ||
      $('meta[property="og:updated_time"]').attr('content') ||
      'Not found';

    const headingsSummary = buildHeadingsSummary($);
    const paragraphs = buildParagraphPreview($);
    const linkSummary = buildLinkSummary($, url);
    const imageSummary = buildImageSummary($);

    const output = [
      `*URL*: ${mdEscape(url)}`,
      `*Title*: ${mdEscape(title)}`,
      `*Canonical*: ${mdEscape(canonical)}`,
      `*Language*: ${mdEscape(lang)}`,
      `*Meta Description*: ${mdEscape(metaDescription)}`,
      `*Meta Keywords*: ${mdEscape(metaKeywords)}`,
      `*Open Graph Title*: ${mdEscape(ogTitle)}`,
      `*Open Graph Description*: ${mdEscape(ogDescription)}`,
      `*Robots*: ${mdEscape(robots)}`,
      `*Last Updated*: ${mdEscape(lastUpdated)}`,
      `*Word Count (approx)*: ${wordCount}`,
      `*Structured Data Blocks*: ${structuredDataBlocks}`,
      `*JavaScript Rendering*: ${SHOULD_RENDER_JS ? 'Enabled via service' : 'Disabled'}`,
      '',
      '*Headings Overview*:',
      ...headingsSummary,
      '',
      '*Content Preview*:',
      ...paragraphs,
      '',
      '*Links*:',
      ...linkSummary,
      '',
      '*Images*:',
      ...imageSummary,
    ];

    return output;
  } catch (error) {
    console.error('Scraping failed:', error.message);
    const serviceMessage = error.response?.data?.message;
    throw new Error(`Scraping failed: ${serviceMessage || error.message}`);
  }
}

module.exports = { scrapeUrl };