const express = require("express");
const { analyzeUrl } = require("../modules/urlAnalyzer");
const { extractFromHtml } = require("../modules/htmlExtractor");
const { extractWithPuppeteer } = require("../modules/puppeteerExtractor");
const { parseHls } = require("../modules/hlsParser");
const { parseDash } = require("../modules/dashParser");
const { extractYoutubeInfo } = require("../modules/youtubeExtractor");

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
    // 3. HTML Page Scrape
    else {
      // First try fast static extraction
      let extractResult = await extractFromHtml(url);
      
      // If no videos found, fallback to Puppeteer (if available/configured)
      if (extractResult.videos.length === 0) {
         console.log(`[Analyze] No static videos found, trying Puppeteer...`);
         try {
           extractResult = await extractWithPuppeteer(url);
         } catch (e) {
           console.warn(`[Analyze] Puppeteer failed: ${e.message}`);
         }
      }

      title = extractResult.title || title;
      thumbnail = extractResult.thumbnail || thumbnail;

      // Process found URLs
      for (const [idx, v] of extractResult.videos.entries()) {
        if (v.type === "hls") {
          try {
            const hlsData = await parseHls(v.url, url);
            const hlsFormats = hlsData.qualities.map(q => ({
              id: `${v.type}_${idx}_${q.id}`,
              type: "hls",
              quality: q.quality,
              url: q.url,
              referer: url
            }));
            formats.push(...hlsFormats);
          } catch (e) {
            console.warn(`[Analyze] Failed to parse HLS ${v.url}: ${e.message}`);
          }
        } else {
          formats.push({
            id: `${v.type}_${idx}`,
            type: v.type,
            quality: "Auto",
            url: v.url,
            referer: url
          });
        }
      }
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
