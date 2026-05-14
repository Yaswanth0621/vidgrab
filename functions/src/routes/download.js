const express = require("express");
const sanitize = require("sanitize-filename");
const { downloadHlsStream, downloadDirectFile, proxyDirectStream } = require("../modules/segmentDownloader");
const { mergeHlsSegments } = require("../modules/mediaMerger");
const { streamFileToClient } = require("../modules/deliveryHandler");
const { getTempPath } = require("../utils/fileHelper");
const fs = require("fs");

const router = express.Router();

router.post("/", async (req, res, next) => {
  try {
    const { streamUrl, formatType, formatExt = "mp4", filename = "video", referer } = req.body;

    if (!streamUrl) {
      return res.status(400).json({ error: "Missing 'streamUrl'" });
    }

    const safeFilename = sanitize(filename) || "vidgrab_download";
    const finalFilename = `${safeFilename}.${formatExt}`;

    console.log(`[Download] Starting download for: ${finalFilename} (${formatType})`);

    let finalFilePath;
    let cleanupPaths = [];

    // HLS Stream
    if (formatType === "hls") {
      // 1. Download segments
      const { segDir, segmentFiles, sessionId } = await downloadHlsStream(streamUrl, referer);
      cleanupPaths.push(segDir);

      // 2. Merge segments
      finalFilePath = await mergeHlsSegments(segmentFiles, sessionId, formatExt);
      cleanupPaths.push(finalFilePath);
      cleanupPaths.push(getTempPath(`vidgrab_list_${sessionId}.txt`));
    } 
    // Direct File (MP4, WebM, etc.)
    else {
      console.log(`[Download] Proxying direct stream for: ${finalFilename}`);
      return await proxyDirectStream(streamUrl, res, finalFilename, referer);
    }

    // 3. Stream to client
    streamFileToClient(res, finalFilePath, finalFilename, cleanupPaths);

  } catch (err) {
    console.error("[Download] Error:", err.message);
    next(err);
  }
});

module.exports = router;
