const express = require("express");
const { analyzeUrl } = require("../modules/urlAnalyzer");
const { extractFromHtml } = require("../modules/htmlExtractor");
const { extractWithPuppeteer } = require("../modules/puppeteerExtractor");
const { parseHls } = require("../modules/hlsParser");
const { parseDash } = require("../modules/dashParser");
const { extractYoutubeInfo } = require("../modules/youtubeExtractor");
const { extractFacebookInfo } = require("../modules/facebookExtractor");
const { extractWithYtdlp } = require("../modules/ytdlpExtractor");

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
    // 3. Universal Fallback via yt-dlp
    else {
      let skipYtdlp = source.skipYtdlp || false;
      let ytdlpData = null;

      if (!skipYtdlp) {
        console.log(`[Analyze] Attempting universal extraction with yt-dlp...`);
        try {
          ytdlpData = await extractWithYtdlp(url);
          title = ytdlpData.title;
          thumbnail = ytdlpData.thumbnail;
          formats = ytdlpData.formats;
        } catch (e) {
          console.warn(`[Analyze] yt-dlp failed: ${e.message}, trying static HTML fallback...`);
        }
      }

      if (!ytdlpData) {
        // First try fast static extraction
        let extractResult = await extractFromHtml(url);
        
        // If no videos found, fallback to Puppeteer (if available/configured)
        if (extractResult && extractResult.videos && extractResult.videos.length === 0) {
           console.log(`[Analyze] No static videos found, trying Puppeteer...`);
           try {
             extractResult = await extractWithPuppeteer(url);
           } catch (e) {
             console.warn(`[Analyze] Puppeteer failed: ${e.message}`);
           }
        }

        if (extractResult) {
          title = extractResult.title || title;
          thumbnail = extractResult.thumbnail || thumbnail;

          // 4. Recursive Iframe scanning (e.g. for VidZP deep nesting)
          if (extractResult.videos.length === 0 && extractResult.iframes && extractResult.iframes.length > 0) {
            console.log(`[Analyze] No videos in top-level, entering recursive iframe scan...`);
            
            const maxDepth = 3;
            let currentDepth = 0;
            let framesToScan = [...extractResult.iframes];
            const scannedFrames = new Set([url]);
            const foundVideos = [];

            while (currentDepth < maxDepth && framesToScan.length > 0) {
              console.log(`[Analyze] Scanning depth ${currentDepth + 1}, ${framesToScan.length} frames...`);
              const nextBatch = [];
              
              for (const frameUrl of framesToScan) {
                if (scannedFrames.has(frameUrl)) continue;
                scannedFrames.add(frameUrl);

                try {
                  const frameResult = await extractFromHtml(frameUrl);
                  if (frameResult && frameResult.videos.length > 0) {
                    foundVideos.push(...frameResult.videos);
                    console.log(`[Analyze] Found ${frameResult.videos.length} videos inside frame: ${frameUrl}`);
                  }
                  if (frameResult && frameResult.iframes) {
                    nextBatch.push(...frameResult.iframes);
                  }
                } catch (e) {
                  console.warn(`[Analyze] Failed to scan frame ${frameUrl}: ${e.message}`);
                }
              }
              
              framesToScan = nextBatch;
              currentDepth++;
              
              // If we found videos at this depth, we can probably stop unless we want ALL qualities
              if (foundVideos.length > 0) break;
            }
            
            extractResult.videos.push(...foundVideos);
          }

          // Process found URLs
          const finalVideos = extractResult.videos || [];
          for (const [idx, v] of finalVideos.entries()) {
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
      } // end catch
    } // end else

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
