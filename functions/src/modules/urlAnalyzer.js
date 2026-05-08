/**
 * URL Analyzer — detects the type of media source from a given URL
 */
const axios = require("axios");
const { getBrowserHeaders } = require("../utils/headers");

const MEDIA_EXTENSIONS = {
  mp4: "mp4",
  webm: "webm",
  mov: "mov",
  avi: "avi",
  mkv: "mkv",
  flv: "flv",
  "3gp": "3gp",
  m3u8: "hls",
  mpd: "dash",
  ts: "ts",
  m4v: "mp4",
  mp3: "mp3",
  aac: "aac",
  m4a: "aac",
};

/**
 * Detect source type from URL
 * Returns: { type: 'mp4'|'hls'|'dash'|'html'|'direct_audio', url, ext }
 */
async function analyzeUrl(url) {
  try {
    const cleanUrl = url.split("?")[0].split("#")[0].toLowerCase();
    const ext = cleanUrl.split(".").pop();

    // Check if YouTube
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      return { type: "youtube", url, isDirect: true };
    }

    // Check if URL has a known media extension
    if (MEDIA_EXTENSIONS[ext]) {
      return {
        type: MEDIA_EXTENSIONS[ext],
        url,
        ext,
        isDirect: true,
      };
    }

    // Try HEAD request to detect Content-Type
    try {
      const headRes = await axios.head(url, {
        headers: getBrowserHeaders(url),
        timeout: 8000,
        maxRedirects: 5,
      });

      const contentType = headRes.headers["content-type"] || "";

      if (contentType.includes("video/mp4") || contentType.includes("video/mpeg")) {
        return { type: "mp4", url, isDirect: true };
      }
      if (contentType.includes("application/x-mpegURL") || contentType.includes("application/vnd.apple.mpegurl")) {
        return { type: "hls", url, isDirect: true };
      }
      if (contentType.includes("application/dash+xml")) {
        return { type: "dash", url, isDirect: true };
      }
      if (contentType.includes("video/webm")) {
        return { type: "webm", url, isDirect: true };
      }
      if (contentType.includes("audio/")) {
        return { type: "audio", url, isDirect: true };
      }
      if (contentType.includes("text/html")) {
        return { type: "html", url, isDirect: false };
      }
    } catch (headErr) {
      // HEAD failed, assume HTML page
      console.log("[URL Analyzer] HEAD failed, defaulting to HTML:", headErr.message);
    }

    // Default: treat as HTML page to scrape
    return { type: "html", url, isDirect: false };
  } catch (err) {
    throw new Error(`URL analysis failed: ${err.message}`);
  }
}

module.exports = { analyzeUrl };
