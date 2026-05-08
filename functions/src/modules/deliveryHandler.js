/**
 * Delivery Handler — streams files back to the client and handles cleanup
 */
const fs = require("fs");
const { deleteFile, deleteDir } = require("../utils/fileHelper");
const mime = require("mime-types");

function streamFileToClient(res, filePath, filename, cleanupPaths = []) {
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found after processing" });
  }

  const stat = fs.statSync(filePath);
  const ext = filePath.split(".").pop();
  const mimeType = mime.lookup(ext) || "application/octet-stream";
  
  // Clean filename for headers
  const safeFilename = encodeURIComponent(filename || `video.${ext}`).replace(/['()]/g, escape).replace(/\*/g, '%2A');

  res.writeHead(200, {
    "Content-Type": mimeType,
    "Content-Length": stat.size,
    "Content-Disposition": `attachment; filename*=UTF-8''${safeFilename}`,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache"
  });

  const readStream = fs.createReadStream(filePath);

  readStream.on("open", () => {
    readStream.pipe(res);
  });

  readStream.on("error", (err) => {
    console.error(`[Delivery] Stream error: ${err.message}`);
    if (!res.headersSent) {
      res.status(500).end("Internal Server Error");
    }
  });

  res.on("finish", () => {
    console.log(`[Delivery] Finished sending ${filePath}`);
    // Cleanup
    setTimeout(() => {
      cleanupPaths.forEach((p) => {
        if (fs.existsSync(p)) {
          if (fs.lstatSync(p).isDirectory()) {
            deleteDir(p);
          } else {
            deleteFile(p);
          }
        }
      });
    }, 1000); // Slight delay to ensure stream is closed
  });
}

module.exports = { streamFileToClient };
