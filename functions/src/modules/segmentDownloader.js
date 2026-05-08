/**
 * Segment Downloader — downloads HLS/DASH segments with concurrency and retry
 */
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { getMediaHeaders } = require("../utils/headers");
const { getTempPath, ensureDir } = require("../utils/fileHelper");
const { fetchMediaPlaylist } = require("./hlsParser");

const MAX_CONCURRENCY = 5;
const MAX_RETRIES = 3;

async function downloadHlsStream(variantUrl, referer, onProgress) {
  // Fetch media playlist
  const segments = await fetchMediaPlaylist(variantUrl, referer);
  if (!segments.length) throw new Error("No segments found in playlist");

  const sessionId = Date.now().toString(36);
  const segDir = getTempPath(`vidgrab_${sessionId}`);
  ensureDir(segDir);

  const segmentFiles = [];
  let downloaded = 0;
  const total = segments.length;

  // Download in batches
  for (let i = 0; i < segments.length; i += MAX_CONCURRENCY) {
    const batch = segments.slice(i, i + MAX_CONCURRENCY);
    await Promise.all(
      batch.map(async (seg, batchIdx) => {
        const segIdx = i + batchIdx;
        const segFile = path.join(segDir, `seg_${String(segIdx).padStart(6, "0")}.ts`);
        await downloadWithRetry(seg.url, segFile, referer);
        segmentFiles[segIdx] = segFile;
        downloaded++;
        if (onProgress) onProgress(downloaded / total);
      })
    );
  }

  return { segDir, segmentFiles: segmentFiles.filter(Boolean), sessionId };
}

async function downloadDirectFile(fileUrl, referer, onProgress) {
  const sessionId = Date.now().toString(36);
  const ext = fileUrl.split("?")[0].split(".").pop() || "mp4";
  const outFile = getTempPath(`vidgrab_direct_${sessionId}.${ext}`);

  const response = await axios({
    method: "GET",
    url: fileUrl,
    headers: getMediaHeaders(referer || fileUrl),
    responseType: "stream",
    timeout: 120000,
    maxRedirects: 5,
  });

  const totalSize = parseInt(response.headers["content-length"] || "0");
  let downloaded = 0;

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(outFile);
    response.data.on("data", (chunk) => {
      downloaded += chunk.length;
      if (onProgress && totalSize > 0) onProgress(downloaded / totalSize);
    });
    response.data.pipe(writer);
    writer.on("finish", () => resolve({ outFile, sessionId, ext }));
    writer.on("error", reject);
  });
}

async function downloadWithRetry(url, destFile, referer, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await axios({
        method: "GET",
        url,
        headers: getMediaHeaders(referer || url),
        responseType: "arraybuffer",
        timeout: 30000,
      });
      fs.writeFileSync(destFile, response.data);
      return;
    } catch (err) {
      if (attempt === retries) throw new Error(`Failed to download segment after ${retries} retries: ${url}`);
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}

module.exports = { downloadHlsStream, downloadDirectFile };
