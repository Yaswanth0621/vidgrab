const youtubedl = require('youtube-dl-exec');

/**
 * yt-dlp Extractor
 * Uses the industry standard yt-dlp to extract video information from thousands of sites.
 */
async function extractWithYtdlp(url) {
  try {
    console.log(`[yt-dlp] Extracting info for: ${url}`);
    
    // We use --dump-json to get the metadata without downloading
    // --no-warnings keeps stdout clean if we were parsing it manually, but youtube-dl-exec handles json output well
    // --no-playlist ensures we only get the single video if a playlist URL is provided
    const output = await youtubedl(url, {
      dumpJson: true,
      noWarnings: true,
      noPlaylist: true,
      flatPlaylist: true,
      noCheckCertificate: true,
      quiet: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
      addHeader: [
        'referer:https://www.youtube.com/',
        'accept-language:en-US,en;q=0.9',
        'origin:https://www.youtube.com',
      ],
      // Use Android client which is currently more resilient to bot detection
      extractorArgs: 'youtube:player_client=android,web',
    });

    if (!output || !output.formats) {
       throw new Error("yt-dlp could not find formats for this URL");
    }

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

  } catch (err) {
    console.error(`[yt-dlp Extractor] Error:`, err.message);
    throw new Error(`Universal extraction failed: ${err.message}`);
  }
}

module.exports = { extractWithYtdlp };
