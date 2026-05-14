const { extractWithYtdlp } = require("./ytdlpExtractor");
const { extractWithPuppeteer } = require("./puppeteerExtractor");

/**
 * Facebook Extractor — uses yt-dlp as primary engine, falls back to Puppeteer.
 * Facebook is heavily protected. yt-dlp handles cookies/session management better.
 */
async function extractFacebookInfo(url) {
  console.log(`[Facebook Extractor] Processing: ${url}`);

  // yt-dlp supports Facebook natively and handles auth better
  try {
    const data = await extractWithYtdlp(url);
    if (data && data.formats && data.formats.length > 0) {
      console.log(`[Facebook Extractor] yt-dlp succeeded, found ${data.formats.length} formats`);
      return data;
    }
  } catch (err) {
    console.warn(`[Facebook Extractor] yt-dlp failed: ${err.message}. Trying Puppeteer...`);
  }

  // Fallback: try mobile Facebook URL via Puppeteer
  try {
    const mobileUrl = url.replace("www.facebook.com", "m.facebook.com");
    const result = await extractWithPuppeteer(mobileUrl);

    const formats = (result.videos || []).map((v, i) => ({
      id: `fb_${i}`,
      type: v.type || "mp4",
      quality: i === 0 ? "HD" : "SD",
      url: v.url,
      ext: "mp4",
      source: "facebook"
    }));

    return {
      title: result.title || "Facebook Video",
      thumbnail: result.thumbnail || "",
      formats
    };
  } catch (err) {
    throw new Error(`Facebook extraction failed: ${err.message}`);
  }
}

module.exports = { extractFacebookInfo };
