/**
 * Puppeteer Extractor — launches headless Chrome to intercept media network requests
 * Used when static HTML parsing fails (JS-heavy sites, React/Vue apps, etc.)
 */
let chromium;
let puppeteer;

try {
  chromium = require("@sparticuz/chromium");
  puppeteer = require("puppeteer-core");
} catch (e) {
  console.warn("[Puppeteer] Dependencies not loaded:", e.message);
}

const MEDIA_URL_PATTERNS = [
  /\.m3u8(\?|$)/i,
  /\.mpd(\?|$)/i,
  /\.mp4(\?|$)/i,
  /\.webm(\?|$)/i,
  /\.ts(\?|$)/i,
  /\/hls\//i,
  /\/dash\//i,
  /\/stream\//i,
  /video\/mp4/i,
  /application\/x-mpegURL/i,
  /application\/dash\+xml/i,
  /\.m4v(\?|$)/i,
];

async function extractWithPuppeteer(pageUrl, timeout = 30000) {
  if (!puppeteer || !chromium) {
    throw new Error("Puppeteer/Chromium not available in this environment");
  }

  let browser;
  const interceptedUrls = new Map(); // url -> { url, type, headers }

  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    // Set browser-like user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Enable request interception
    await page.setRequestInterception(true);

    page.on("request", (request) => {
      const url = request.url();
      const resourceType = request.resourceType();

      // Intercept media requests
      if (resourceType === "media" || resourceType === "xhr" || resourceType === "fetch" || resourceType === "other") {
        if (MEDIA_URL_PATTERNS.some((p) => p.test(url))) {
          interceptedUrls.set(url, {
            url,
            type: detectTypeFromUrl(url),
            source: "puppeteer_intercept",
            resourceType,
          });
        }
      }

      // Block unnecessary resources to speed up
      if (["image", "font", "stylesheet"].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Also intercept responses for content-type detection
    page.on("response", async (response) => {
      const url = response.url();
      const contentType = response.headers()["content-type"] || "";

      if (
        contentType.includes("video/") ||
        contentType.includes("application/x-mpegURL") ||
        contentType.includes("application/dash+xml") ||
        contentType.includes("application/octet-stream")
      ) {
        if (!interceptedUrls.has(url)) {
          interceptedUrls.set(url, {
            url,
            type: detectTypeFromContentType(contentType) || detectTypeFromUrl(url),
            source: "puppeteer_response",
            contentType,
          });
        }
      }
    });

    // Navigate with a timeout
    await page.goto(pageUrl, {
      waitUntil: "networkidle2",
      timeout,
    });

    // Wait a bit for lazy-loaded content
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Try clicking play buttons to trigger media requests
    const playSelectors = [
      'button[class*="play"]',
      'button[aria-label*="play" i]',
      '.play-button',
      '#play-button',
      '[data-action="play"]',
      '.vjs-big-play-button',
      '.ytp-play-button',
      '.video-click-to-play'
    ];

    for (const sel of playSelectors) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          console.log(`[Puppeteer] Triggering play button: ${sel}`);
          await btn.click();
          await new Promise((resolve) => setTimeout(resolve, 3000));
          break;
        }
      } catch (_) {}
    }

    // SPECIAL: Extract YouTube direct URLs from the page state if network interception missed them
    if (pageUrl.includes('youtube.com') || pageUrl.includes('youtu.be')) {
      const ytData = await page.evaluate(() => {
        try {
          return {
            playerResponse: window.ytInitialPlayerResponse,
            playerConfig: window.ytplayer?.config
          };
        } catch (e) { return null; }
      });

      if (ytData && ytData.playerResponse) {
        const formats = ytData.playerResponse.streamingData?.adaptiveFormats || [];
        for (const f of formats) {
          if (f.url) {
            interceptedUrls.set(f.url, {
              url: f.url,
              type: f.mimeType?.includes('video') ? 'mp4' : 'audio',
              quality: f.qualityLabel || f.audioQuality || 'Auto',
              source: 'yt_internal_state'
            });
          }
        }
      }
    }

    // Extract page metadata
    const metadata = await page.evaluate(() => {
      return {
        title: document.title || document.querySelector('meta[property="og:title"]')?.getAttribute("content") || "",
        thumbnail:
          document.querySelector('meta[property="og:image"]')?.getAttribute("content") ||
          document.querySelector('meta[name="twitter:image"]')?.getAttribute("content") ||
          "",
        description: document.querySelector('meta[property="og:description"]')?.getAttribute("content") || "",
      };
    });

    // Also search page source for video URLs (Deep Scan)
    const pageContent = await page.content();
    const scriptUrls = [];
    extractUrlsFromText(pageContent, scriptUrls);

    const allUrls = [
      ...Array.from(interceptedUrls.values()),
      ...scriptUrls.filter((u) => !interceptedUrls.has(u.url)),
    ];

    return { videos: allUrls, ...metadata };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function extractUrlsFromText(text, results) {
  const patterns = [
    /["'`](https?:\/\/[^"'`\s]+\.m3u8[^"'`\s]*)/gi,
    /["'`](https?:\/\/[^"'`\s]+\.mpd[^"'`\s]*)/gi,
    /["'`](https?:\/\/[^"'`\s]+\.mp4[^"'`\s]*)/gi,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const url = match[1].replace(/\\u002F/g, "/").replace(/\\/g, "");
      if (url) {
        results.push({ url, type: detectTypeFromUrl(url), source: "page_source_scan" });
      }
    }
  }
}

function detectTypeFromUrl(url) {
  const lower = url.toLowerCase().split("?")[0];
  if (lower.includes(".m3u8")) return "hls";
  if (lower.includes(".mpd")) return "dash";
  if (lower.includes(".mp4")) return "mp4";
  if (lower.includes(".webm")) return "webm";
  return "video";
}

function detectTypeFromContentType(ct) {
  if (ct.includes("mpegURL") || ct.includes("x-mpegurl")) return "hls";
  if (ct.includes("dash+xml")) return "dash";
  if (ct.includes("video/mp4")) return "mp4";
  if (ct.includes("video/webm")) return "webm";
  return null;
}

module.exports = { extractWithPuppeteer };
