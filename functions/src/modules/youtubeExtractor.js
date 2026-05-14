const { extractWithYtdlp } = require("./ytdlpExtractor");

/**
 * YouTube Extractor — now powered by yt-dlp for maximum compatibility.
 * Handles both youtube.com and youtu.be short URLs.
 */
async function extractYoutubeInfo(url) {
  console.log(`[YouTube Extractor] Processing: ${url}`);
  try {
    // yt-dlp handles YouTube natively and supports all URL formats
    const data = await extractWithYtdlp(url);
    return data;
  } catch (err) {
    console.error("[YouTube Extractor] Error:", err.message);
    throw new Error(`YouTube extraction failed: ${err.message}`);
  }
}

module.exports = { extractYoutubeInfo };
