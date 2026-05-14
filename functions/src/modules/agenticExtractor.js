const { extractWithYtdlp } = require('./ytdlpExtractor');
const { extractWithPuppeteer } = require('./puppeteerExtractor');
const { extractFromHtml } = require('./htmlExtractor');
const fs = require('fs');
const path = require('path');

/**
 * Agentic Extractor Module
 * An intelligent orchestrator that tries multiple extraction strategies
 * until it succeeds or exhausts all options.
 */
async function agenticExtract(url) {
  console.log(`[Agentic] Starting extraction for: ${url}`);
  
  const strategies = [
    { name: 'Stealth yt-dlp', fn: tryYtdlp },
    { name: 'Headless Chrome Agent', fn: tryPuppeteer },
    { name: 'Static HTML Deep Scan', fn: tryHtmlScan }
  ];

  let lastError = null;

  for (const strategy of strategies) {
    console.log(`[Agentic] Trying Strategy: ${strategy.name}...`);
    try {
      const result = await strategy.fn(url);
      if (result && result.formats && result.formats.length > 0) {
        console.log(`[Agentic] Strategy ${strategy.name} SUCCESS!`);
        return result;
      }
    } catch (e) {
      console.warn(`[Agentic] Strategy ${strategy.name} FAILED: ${e.message}`);
      lastError = e;
    }
    
    // Tiny delay between strategies to avoid triggering rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw lastError || new Error("All extraction strategies failed.");
}

async function tryYtdlp(url) {
  return await extractWithYtdlp(url);
}

async function tryPuppeteer(url) {
  console.log(`[Agentic] Launching Headless Chrome to bypass bot-detection...`);
  const result = await extractWithPuppeteer(url);
  
  if (result.videos && result.videos.length > 0) {
    return {
      title: result.title,
      thumbnail: result.thumbnail,
      formats: result.videos.map((v, i) => ({
        id: `agent_p_${i}`,
        url: v.url,
        quality: v.quality || 'Auto',
        type: v.type || 'mp4',
        source: 'headless_agent'
      }))
    };
  }
  throw new Error("Puppeteer could not find any playable media.");
}

async function tryHtmlScan(url) {
  console.log(`[Agentic] Performing deep static HTML scan for: ${url}`);
  
  const extractResult = await extractFromHtml(url);
  const foundVideos = [...extractResult.videos];
  
  // Recursive Iframe scanning (e.g. for VidZP deep nesting)
  if (foundVideos.length === 0 && extractResult.iframes && extractResult.iframes.length > 0) {
    console.log(`[Agentic] No videos in top-level, entering recursive iframe scan...`);
    
    const maxDepth = 3;
    let currentDepth = 0;
    let framesToScan = [...extractResult.iframes];
    const scannedFrames = new Set([url]);

    while (currentDepth < maxDepth && framesToScan.length > 0) {
      console.log(`[Agentic] Scanning depth ${currentDepth + 1}, ${framesToScan.length} frames...`);
      const nextBatch = [];
      
      for (const frameUrl of framesToScan) {
        if (scannedFrames.has(frameUrl)) continue;
        scannedFrames.add(frameUrl);

        try {
          const frameResult = await extractFromHtml(frameUrl);
          if (frameResult && frameResult.videos.length > 0) {
            foundVideos.push(...frameResult.videos);
            console.log(`[Agentic] Found ${frameResult.videos.length} videos inside frame: ${frameUrl}`);
          }
          if (frameResult && frameResult.iframes) {
            nextBatch.push(...frameResult.iframes);
          }
        } catch (e) {
          console.warn(`[Agentic] Failed to scan frame ${frameUrl}: ${e.message}`);
        }
      }
      
      framesToScan = nextBatch;
      currentDepth++;
      
      if (foundVideos.length > 0) break;
    }
  }

  if (foundVideos.length > 0) {
    return {
      title: extractResult.title,
      thumbnail: extractResult.thumbnail,
      formats: foundVideos.map((v, i) => ({
        id: `agent_h_${i}`,
        url: v.url,
        quality: 'Auto',
        type: v.type || 'mp4',
        source: 'html_scan'
      }))
    };
  }
  throw new Error("Static scan found no video sources.");
}

module.exports = { agenticExtract };
