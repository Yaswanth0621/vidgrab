/**
 * Media Merger — uses FFmpeg to concatenate TS segments and mux to MP4
 */
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const { getTempPath } = require("../utils/fileHelper");

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

async function mergeHlsSegments(segmentFiles, sessionId, format = "mp4") {
  if (!segmentFiles || segmentFiles.length === 0) {
    throw new Error("No segments to merge");
  }

  const listFile = getTempPath(`vidgrab_list_${sessionId}.txt`);
  const outFile = getTempPath(`vidgrab_out_${sessionId}.${format}`);

  // Create concat list file
  const listContent = segmentFiles.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join("\n");
  fs.writeFileSync(listFile, listContent);

  return new Promise((resolve, reject) => {
    let command = ffmpeg()
      .input(listFile)
      .inputOptions(["-f", "concat", "-safe", "0"])
      .outputOptions("-c", "copy"); // Fast remuxing

    if (format === "mp3") {
      command = command.outputOptions("-q:a", "0", "-map", "a");
    }

    command
      .output(outFile)
      .on("start", (cmdLine) => console.log(`[FFmpeg] Started: ${cmdLine}`))
      .on("error", (err) => {
        console.error(`[FFmpeg] Error: ${err.message}`);
        reject(err);
      })
      .on("end", () => {
        console.log(`[FFmpeg] Finished merging ${segmentFiles.length} segments`);
        resolve(outFile);
      })
      .run();
  });
}

module.exports = { mergeHlsSegments };
