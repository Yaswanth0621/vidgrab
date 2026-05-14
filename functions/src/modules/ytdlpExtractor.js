const youtubedl = require('youtube-dl-exec');
const fs = require('fs');
const path = require('path');

/**
 * yt-dlp Extractor
 * Uses the industry standard yt-dlp to extract video information from thousands of sites.
 */
async function extractWithYtdlp(url) {
  try {
    console.log(`[yt-dlp] Extracting info for: ${url}`);
    
    // Path to cookies file if the user uploads one to bypass bot detection
    const cookiesPath = path.join(process.cwd(), 'cookies.txt');
    const useCookies = fs.existsSync(cookiesPath);
    if (useCookies) console.log(`[yt-dlp] Using cookies from: ${cookiesPath}`);

    // List of clients to try for YouTube (some are harder for YouTube to block than others)
    const ytClients = ['tvhtml5', 'android', 'ios', 'mweb', 'web'];
    let lastError = null;

    for (const client of ytClients) {
      try {
        const options = {
          dumpJson: true,
          noWarnings: true,
          noPlaylist: true,
          flatPlaylist: true,
          noCheckCertificate: true,
          quiet: true,
          userAgent: client === 'ios' 
            ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
            : 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
          addHeader: [
            'referer:https://www.youtube.com/',
            'accept-language:en-US,en;q=0.9',
            'origin:https://www.youtube.com',
          ],
          extractorArgs: `youtube:player_client=${client},web`,
        };

        if (useCookies) {
          options.cookie = cookiesPath;
        }

        const output = await youtubedl(url, options);
        if (output && output.formats) {
          return processYtdlpOutput(output);
        }
      } catch (err) {
        lastError = err;
        const errMsg = err.message || "";
        // If it's not a bot error, don't bother retrying with other clients
        if (!errMsg.includes("Sign in to confirm you") && !errMsg.includes("bot")) {
          break;
        }
        console.log(`[yt-dlp] Client ${client} failed with bot detection, trying next...`);
      }
    }

    throw lastError || new Error("yt-dlp could not find formats for this URL");
  } catch (error) {
    console.error(`[yt-dlp Extractor] Error: ${error.message}`);
    throw new Error(`Universal extraction failed: ${error.message}`);
  }
}

function processYtdlpOutput(output) {
    const title = output.title || "Video";
    const thumbnail = output.thumbnail || "";
    const description = output.description || "";
    
    const formats = [];

    // yt-dlp returns many formats. We want to filter for playable ones.
    for (const f of output.formats) {
      // Skip formats without URLs or that are just storyboards
      if (!f.url || f.format_id === 'storyboard' || f.protocol === 'mhtml') continue;

      let quality = f.format_note || f.resolution || "Auto";
      if (f.height) {
          quality = `${f.height}p`;
      }
      
      const isVideo = f.vcodec !== 'none';
      const isAudio = f.acodec !== 'none';
      
      // If it has no video and no audio, it's useless
      if (!isVideo && !isAudio) continue;
      
      let type = f.ext || "mp4";
      if (f.protocol === 'm3u8' || f.protocol === 'm3u8_native') {
          type = "hls";
      } else if (f.protocol === 'dash') {
          type = "dash";
      }

      // Determine label based on adaptive vs combined
      let label = quality;
      let isAdaptive = false;
      
      if (isVideo && !isAudio) {
          label = `${quality} (Video Only)`;
          isAdaptive = true;
      } else if (!isVideo && isAudio) {
          label = "Audio Only";
          type = "mp3"; // Simplify for frontend display
      }

      formats.push({
        id: `ytdlp_${f.format_id}`,
        type: type,
        quality: label,
        url: f.url,
        ext: f.ext || "mp4",
        source: "yt-dlp",
        isAdaptive: isAdaptive,
        hasVideo: isVideo,
        hasAudio: isAudio
      });
    }

    // Sort formats: Combined highest quality first, then video-only, then audio-only
    formats.sort((a, b) => {
        if (a.hasVideo && a.hasAudio && (!b.hasVideo || !b.hasAudio)) return -1;
        if ((!a.hasVideo || !a.hasAudio) && b.hasVideo && b.hasAudio) return 1;
        
        // Basic resolution sorting if both are combined or both are video-only
        const aRes = parseInt(a.quality) || 0;
        const bRes = parseInt(b.quality) || 0;
        return bRes - aRes;
    });

    return {
      title,
      thumbnail,
      description,
      formats
    };
}

module.exports = { extractWithYtdlp };
