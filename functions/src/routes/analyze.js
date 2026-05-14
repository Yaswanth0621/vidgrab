const express = require("express");
const { analyzeUrl } = require("../modules/urlAnalyzer");
const { extractFromHtml } = require("../modules/htmlExtractor");
const { extractWithPuppeteer } = require("../modules/puppeteerExtractor");
const { parseHls } = require("../modules/hlsParser");
const { parseDash } = require("../modules/dashParser");
const { extractYoutubeInfo } = require("../modules/youtubeExtractor");
const { extractFacebookInfo } = require("../modules/facebookExtractor");
const { extractWithYtdlp } = require("../modules/ytdlpExtractor");
const { agenticExtract } = require("../modules/agenticExtractor");

const router = express.Router();

router.post("/", async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "Missing 'url' parameter" });
    }

    console.log(`[Analyze] Analyzing URL: ${url}`);
    
    // 1. Analyze URL type
    const source = await analyzeUrl(url);
    console.log(`[Analyze] Source type: ${source.type}, isDirect: ${source.isDirect}`);

    let title = "Video";
    let thumbnail = "";
    let formats = [];

    // 2. Direct Media URL (HLS, DASH, MP4, etc.)
    if (source.isDirect) {
      if (source.type === "hls") {
        const hlsData = await parseHls(source.url, url);
        formats = hlsData.qualities.map(q => ({
          id: q.id,
          type: "hls",
          quality: q.quality,
          url: q.url,
          bandwidth: q.bandwidth
        }));
      } else if (source.type === "dash") {
        const dashData = await parseDash(source.url, url);
        formats = dashData.qualities;
      } else if (source.type === "youtube") {
        const ytData = await extractYoutubeInfo(source.url);
        title = ytData.title;
        thumbnail = ytData.thumbnail;
        formats = ytData.formats;
      } else {
        formats = [{ id: "direct_1", type: source.type, quality: "Auto", url: source.url }];
      }
    } 
    // Handle Specific Extractors (Facebook, etc.) that aren't direct URLs but shouldn't use generic HTML fallback
    else if (source.type === "facebook") {
      const fbData = await extractFacebookInfo(source.url);
      title = fbData.title;
      thumbnail = fbData.thumbnail;
      formats = fbData.formats;
    }
    // 3. Universal Fallback via Agentic Extractor
    else {
      console.log(`[Analyze] Handing over to Agentic Extractor...`);
      const agentResult = await agenticExtract(url);
      title = agentResult.title || title;
      thumbnail = agentResult.thumbnail || thumbnail;
      formats = agentResult.formats;
    }


    if (formats.length === 0) {
      return res.status(404).json({ error: "No video formats found at this URL." });
    }

    // Deduplicate formats by URL
    const uniqueFormats = Array.from(new Map(formats.map(item => [item.url, item])).values());

    res.json({
      title,
      thumbnail,
      formats: uniqueFormats
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;
