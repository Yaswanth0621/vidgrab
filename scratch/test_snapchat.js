const axios = require('axios');
const fs = require('fs');

async function debugUrl(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    fs.writeFileSync('C:/Users/yaswanth/.gemini/antigravity/brain/8ef266cb-337f-4cb9-b33f-a6013122766f/scratch/page.html', response.data);
    console.log("Saved HTML to scratch/page.html");
  } catch (e) {
    console.error("Error:", e.message);
  }
}

debugUrl("https://www.snapchat.com/spotlight/W7_EDlXWTBiXAEEniNoMPwAAYb3JwYmFwa3ByAZ3w0HsvAZ3wz6AfAAAAAQ?share_id=Ab4ao70kVWE&locale=en-IN");
