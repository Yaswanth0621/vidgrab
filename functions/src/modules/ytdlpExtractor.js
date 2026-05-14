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
    
    // Path to cookies file (check both script dir and current working dir)
    const possiblePaths = [
      path.join(__dirname, '..', '..', 'cookies.txt'),
      path.join(process.cwd(), 'cookies.txt'),
      path.join(process.cwd(), 'functions', 'cookies.txt')
    ];
    
    let cookiesPath = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        cookiesPath = p;
        break;
      }
    }

    const useCookies = !!cookiesPath;
    if (useCookies) console.log(`[yt-dlp] Using cookies from: ${cookiesPath}`);

    // List of clients to try for YouTube
    // We start with 'null' (standard web) because with cookies it's most reliable
    const ytClients = [null, 'tvhtml5', 'android', 'mweb', 'web', 'ios'];
    let lastError = null;

    for (const client of ytClients) {
      try {
        const options = {
          dumpJson: true,
          noWarnings: true,
          noPlaylist: true,
          flatPlaylist: true,
          noCheckCertificate: true,
          noCheckFormats: true,
          format: '*',
          quiet: true,
          addHeader: [
            'referer:https://www.youtube.com/',
            'accept-language:en-US,en;q=0.9',
          ],
        };

        if (useCookies) {
          options.cookies = cookiesPath;
        }

        // Only add extractor args if a specific client is requested
        if (client) {
          options.extractorArgs = `youtube:player_client=${client}`;
          console.log(`[yt-dlp] Trying client: ${client}`);
        } else {
          console.log(`[yt-dlp] Trying default web extraction...`);
        }

        const output = await youtubedl(url, options);
        if (output && output.formats) {
          return processYtdlpOutput(output);
        }
      } catch (err) {
        lastError = err;
        const errMsg = err.message || "";
        console.log(`[yt-dlp] Client ${client || 'default'} failed: ${errMsg.split('\n')[0]}`);
        
        // If it's a "format not available" error, keep trying other clients
        // If it's a bot error, keep trying other clients
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
