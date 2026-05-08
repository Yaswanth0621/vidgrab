const path = require("path");
const fs = require("fs");
const os = require("os");

/**
 * Create a temp file path in /tmp (Firebase Functions allows this)
 */
function getTempPath(filename) {
  return path.join(os.tmpdir(), filename);
}

/**
 * Delete a file silently
 */
function deleteFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn("[FileHelper] Could not delete:", filePath, err.message);
  }
}

/**
 * Delete a directory recursively
 */
function deleteDir(dirPath) {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn("[FileHelper] Could not delete dir:", dirPath, err.message);
  }
}

/**
 * Ensure a directory exists
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get file size in bytes
 */
function getFileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

module.exports = { getTempPath, deleteFile, deleteDir, ensureDir, getFileSize };
