const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const util = require('util');
const execFilePromise = util.promisify(execFile);

/**
 * yt-dlp Extractor (Direct Binary Edition)
 * Calls the bundled yt-dlp binary directly to avoid GitHub rate limits.
 */
async function extractWithYtdlp(url) {
  try {
    console.log(`[yt-dlp] Extracting info for: ${url}`);
    
    // Find the binary
    const binaryPath = path.join(__dirname, '..', '..', 'bin', 'yt-dlp');
    if (!fs.existsSync(binaryPath)) {
        console.log(`[yt-dlp] Binary not found at ${binaryPath}, trying system path...`);
    } else {
        // Ensure it's executable
        try { fs.chmodSync(binaryPath, 0o755); } catch (e) {}
    }

    const exePath = fs.existsSync(binaryPath) ? binaryPath : 'yt-dlp';

    // Path to cookies file
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

    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
    const domain = new URL(url).hostname;
    
    // Prioritize clients that are more resistant to "Sign in" blocks
    const ytClients = isYouTube ? ['tvhtml5', 'android', 'mweb_embedded', 'web_embedded', 'mweb', 'web', 'ios'] : [null];
    let lastError = null;

    for (const client of ytClients) {
      try {
        const args = [
          url,
          '--dump-json',
          '--no-warnings',
          '--no-playlist',
          '--flat-playlist',
          '--no-check-certificate',
          '--no-check-formats',
          '--quiet',
          '--impersonate', 'chrome',
          '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          '--add-header', `referer:https://${domain}/`,
          '--add-header', `origin:https://${domain}`,
          '--add-header', 'accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          '--add-header', 'accept-language:en-US,en;q=0.9',
          '--add-header', 'sec-ch-ua:"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
          '--add-header', 'sec-ch-ua-mobile:?0',
          '--add-header', `sec-ch-ua-platform:"Windows"`,
          '--add-header', 'sec-fetch-dest:document',
          '--add-header', 'sec-fetch-mode:navigate',
          '--add-header', 'sec-fetch-site:same-origin',
          '--add-header', 'sec-fetch-user:?1',
          '--add-header', 'upgrade-insecure-requests:1'
        ];

        if (useCookies) {
          args.push('--cookies', cookiesPath);
          args.push('--no-cache-dir');
          // Increase sleep to cool down the IP
          if (isYouTube) args.push('--sleep-requests', '2'); 
        }

        if (isYouTube) {
          args.push('--extractor-args', `youtube:player_client=${client}`);
          console.log(`[yt-dlp] Trying YouTube client: ${client}`);
        } else {
          console.log(`[yt-dlp] Universal extraction attempt for: ${url}`);
        }

        const { stdout } = await execFilePromise(exePath, args, { maxBuffer: 10 * 1024 * 1024 });
        
        if (stdout) {
          const output = JSON.parse(stdout);
          if (output && output.formats) {
            return processYtdlpOutput(output);
          }
        }
      } catch (err) {
        lastError = err;
        const errMsg = err.message || "";
        console.log(`[yt-dlp] Client ${client || 'default'} failed: ${errMsg.split('\n')[0]}`);
        
        // If we only have one client (non-YouTube), don't loop
        if (!isYouTube) break;
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

    for (const f of output.formats) {
      if (!f.url || f.format_id === 'storyboard' || f.protocol === 'mhtml') continue;

      let quality = f.format_note || f.resolution || "Auto";
      if (f.height) {
          quality = `${f.height}p`;
      }
      
      const isVideo = f.vcodec !== 'none';
      const isAudio = f.acodec !== 'none';
      if (!isVideo && !isAudio) continue;
      
      let type = f.ext || "mp4";
      if (f.protocol === 'm3u8' || f.protocol === 'm3u8_native') {
          type = "hls";
      } else if (f.protocol === 'dash') {
          type = "dash";
      }

      let label = quality;
      let isAdaptive = false;
      
      if (isVideo && !isAudio) {
          label = `${quality} (Video Only)`;
          isAdaptive = true;
      } else if (!isVideo && isAudio) {
          label = "Audio Only";
          type = "mp3";
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

    formats.sort((a, b) => {
        if (a.hasVideo && a.hasAudio && (!b.hasVideo || !b.hasAudio)) return -1;
        if ((!a.hasVideo || !a.hasAudio) && b.hasVideo && b.hasAudio) return 1;
        const aRes = parseInt(a.quality) || 0;
        const bRes = parseInt(b.quality) || 0;
        return bRes - aRes;
    });

    return { title, thumbnail, description, formats };
}

module.exports = { extractWithYtdlp };
