/**
 * HTML Extractor — statically parses HTML to find video sources
 * Uses cheerio (server-side jQuery) for DOM parsing
 */
const axios = require("axios");
const cheerio = require("cheerio");
const { getBrowserHeaders } = require("../utils/headers");

const VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/x-msvideo", "application/x-mpegurl", "application/dash+xml"];

async function extractFromHtml(pageUrl) {
  // Fetch the HTML
  const response = await axios.get(pageUrl, {
    headers: getBrowserHeaders(pageUrl),
    timeout: 15000,
    maxRedirects: 5,
  });

  const html = response.data;
  const $ = cheerio.load(html);
  const found = [];

  // 1. <video src="..."> and <video><source src="..."></video>
  $("video").each((_, el) => {
    const src = $(el).attr("src");
    if (src && isMediaUrl(src)) {
      found.push({ url: resolveUrl(src, pageUrl), type: detectType(src), source: "video_tag" });
    }
    $(el).find("source").each((_, source) => {
      const ssrc = $(source).attr("src");
      const stype = $(source).attr("type") || "";
      if (ssrc && isMediaUrl(ssrc)) {
        found.push({ url: resolveUrl(ssrc, pageUrl), type: detectType(ssrc, stype), source: "source_tag" });
      }
    });
  });

  // 2. Open Graph video
  const ogVideo = $('meta[property="og:video"]').attr("content") || $('meta[property="og:video:url"]').attr("content");
  if (ogVideo && isMediaUrl(ogVideo)) {
    found.push({ url: ogVideo, type: detectType(ogVideo), source: "og_video" });
  }

  // 3. Twitter player
  const twitterPlayer = $('meta[name="twitter:player:stream"]').attr("content");
  if (twitterPlayer && isMediaUrl(twitterPlayer)) {
    found.push({ url: twitterPlayer, type: detectType(twitterPlayer), source: "twitter_player" });
  }

  // 4. JSON-LD structured data
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html());
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item.contentUrl && isMediaUrl(item.contentUrl)) {
          found.push({ url: item.contentUrl, type: detectType(item.contentUrl), source: "json_ld" });
        }
        if (item.embedUrl) {
          found.push({ url: item.embedUrl, type: "embed", source: "json_ld_embed" });
        }
      }
    } catch (_) {}
  });

  // 5. Scan all <script> tags for .m3u8 / .mpd / .mp4 patterns
  const scriptUrls = [];
  $("script").each((_, el) => {
    const content = $(el).html() || "";
    extractUrlsFromScript(content, pageUrl, scriptUrls);
  });
  for (const u of scriptUrls) {
    if (!found.some((f) => f.url === u.url)) {
      found.push(u);
    }
  }

  // 6. data-src, data-video-src attributes
  $("[data-src],[data-video-src],[data-video],[data-hls],[data-stream]").each((_, el) => {
    const attrs = ["data-src", "data-video-src", "data-video", "data-hls", "data-stream"];
    for (const attr of attrs) {
      const val = $(el).attr(attr);
      if (val && isMediaUrl(val)) {
        found.push({ url: resolveUrl(val, pageUrl), type: detectType(val), source: "data_attr" });
      }
    }
  });

  // 7. iframe src (for embedded players)
  const iframes = [];
  $("iframe").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src");
    if (src && src.trim()) {
      const resolved = resolveUrl(src, pageUrl);
      iframes.push(resolved);
      
      // Special case: VidZP relative ip129jk
      if (resolved.includes("/ip129jk?id=")) {
         iframes.push(resolved); // Already resolved
      }
    }
  });

  // 8. Special VidZP check
  if (pageUrl.includes("vidzp.com")) {
    const iframeIdMatch = html.match(/var iframeId = '([^']+)';/);
    if (iframeIdMatch) {
       iframes.push(resolveUrl(`/ip129jk?id=${iframeIdMatch[1]}`, pageUrl));
    }
  }

  // Deduplicate
  const unique = [];
  const seen = new Set();
  for (const item of found) {
    if (!seen.has(item.url)) {
      seen.add(item.url);
      unique.push(item);
    }
  }

  // Extract metadata
  const title = $("title").text().trim() || $('meta[property="og:title"]').attr("content") || "Untitled Video";
  const thumbnail =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    "";
  const description = $('meta[property="og:description"]').attr("content") || "";

  return { videos: unique, iframes: [...new Set(iframes)], title, thumbnail, description, html };
}

function extractUrlsFromScript(scriptContent, baseUrl, results) {
  // Match common m3u8/mpd/mp4 patterns
  const patterns = [
    /["'`](https?:\/\/[^"'` \n\r\t]+\.(?:m3u8|mpd|mp4|webm|mov|ts)[^"'` \n\r\t]*)/gi,
    /["'`](https?:\/\/[^"'` \n\r\t]+playlist\.m3u8[^"'` \n\r\t]*)/gi,
    /"file"\s*:\s*["'`](https?:\/\/[^"'`\s]+)/gi,
    /"src"\s*:\s*["'`](https?:\/\/[^"'` \n\r\t]+\.(?:mp4|m3u8|mpd|webm)[^"'` \n\r\t]*)/gi,
    /source\s*:\s*["'`](https?:\/\/[^"'` \n\r\t]+\.(?:mp4|m3u8|mpd|webm)[^"'` \n\r\t]*)/gi,
    /hlsUrl\s*[=:]\s*["'`](https?:\/\/[^"'`\s]+)/gi,
    /dashUrl\s*[=:]\s*["'`](https?:\/\/[^"'`\s]+)/gi,
    /videoUrl\s*[=:]\s*["'`](https?:\/\/[^"'`\s]+)/gi,
    /streamUrl\s*[=:]\s*["'`](https?:\/\/[^"'`\s]+)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(scriptContent)) !== null) {
      const url = match[1].replace(/\\u002F/g, "/").replace(/\\/g, "");
      if (url) {
        // Handle relative URLs in scripts if they start with /
        const resolved = url.startsWith("http") ? url : resolveUrl(url, baseUrl);
        if (isMediaUrl(resolved)) {
           results.push({ url: resolved, type: detectType(resolved), source: "script_scan" });
        }
      }
    }
  }
}

function isMediaUrl(url) {
  if (!url || typeof url !== "string") return false;
  if (url.startsWith("blob:")) return false;
  const lower = url.toLowerCase().split("?")[0];
  const mediaExts = [".mp4", ".m3u8", ".mpd", ".webm", ".mov", ".avi", ".mkv", ".flv", ".ts", ".mp3", ".aac", ".m4v", ".m4a"];
  if (mediaExts.some((ext) => lower.endsWith(ext))) return true;
  // Check for common CDN patterns
  if (lower.includes("/hls/") || lower.includes("/dash/") || lower.includes("/stream/")) return true;
  if (lower.includes("playlist") && lower.includes("m3u8")) return true;
  return false;
}

function detectType(url, mimeType = "") {
  const lower = (url || "").toLowerCase().split("?")[0];
  if (lower.endsWith(".m3u8") || mimeType.includes("mpegurl")) return "hls";
  if (lower.endsWith(".mpd") || mimeType.includes("dash")) return "dash";
  if (lower.endsWith(".mp4") || lower.endsWith(".m4v")) return "mp4";
  if (lower.endsWith(".webm")) return "webm";
  if (lower.endsWith(".mov")) return "mov";
  if (lower.endsWith(".mp3")) return "mp3";
  if (lower.endsWith(".aac") || lower.endsWith(".m4a")) return "aac";
  if (lower.endsWith(".ts")) return "ts";
  return "video";
}

function resolveUrl(url, base) {
  try {
    if (url.startsWith("http")) return url;
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

module.exports = { extractFromHtml };
