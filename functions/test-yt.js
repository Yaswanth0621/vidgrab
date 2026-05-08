const ytdl = require("@distube/ytdl-core");

async function test() {
  const url = "https://youtu.be/tLOX4wzCW9s?si=pbYkRexY-DbRDXKI";
  console.log("Testing URL:", url);
  try {
    const info = await ytdl.getInfo(url);
    console.log("Success! Title:", info.videoDetails.title);
    console.log("Total formats found:", info.formats.length);
    info.formats.forEach(f => {
      console.log(`- itag: ${f.itag}, quality: ${f.qualityLabel}, hasVideo: ${f.hasVideo}, hasAudio: ${f.hasAudio}`);
    });
  } catch (err) {
    console.error("FAILED:", err.message);
  }
}

test();
