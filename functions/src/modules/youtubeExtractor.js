const ytdl = require("@distube/ytdl-core");

/**
 * YouTube Extractor — uses ytdl-core to fetch video info and formats
 */
async function extractYoutubeInfo(url) {
  try {
    const info = await ytdl.getInfo(url);
    
    const combinedFormats = info.formats.filter(f => f.hasVideo && f.hasAudio);
    
    let formats = [];
    
    if (combinedFormats.length > 0) {
      formats = combinedFormats.map(f => ({
        id: `yt_${f.itag}`,
        type: "mp4",
        quality: f.qualityLabel || "Auto",
        url: f.url,
        ext: "mp4",
        source: "youtube"
      }));
    } else {
      // Fallback: Pick best video-only formats and label them (needs merging logic later)
      formats = info.formats
        .filter(f => f.hasVideo)
        .map(f => ({
          id: `yt_${f.itag}`,
          type: "mp4",
          quality: `${f.qualityLabel || "Auto"} (Video Only)`,
          url: f.url,
          ext: "mp4",
          source: "youtube",
          isAdaptive: true
        }));
        
      // Also add audio only
      const bestAudio = info.formats.find(f => !f.hasVideo && f.hasAudio);
      if (bestAudio) {
        formats.push({
          id: `yt_audio`,
          type: "mp3",
          quality: "Audio Only",
          url: bestAudio.url,
          ext: "mp3",
          source: "youtube"
        });
      }
    }

    // Also include adaptive formats (video only / audio only) if needed, 
    // but combined is easier for direct download without merging.
    // For higher quality (1080p+), YouTube uses separate video/audio streams.
    
    return {
      title: info.videoDetails.title,
      thumbnail: info.videoDetails.thumbnails[0]?.url || "",
      formats: formats
    };
  } catch (err) {
    console.error("[YouTube Extractor] Error:", err.message);
    throw new Error(`YouTube extraction failed: ${err.message}`);
  }
}

module.exports = { extractYoutubeInfo };
