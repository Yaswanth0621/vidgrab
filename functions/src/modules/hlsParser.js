/**
 * HLS Parser — parses .m3u8 master and media playlists
 */
const axios = require("axios");
const { getMediaHeaders } = require("../utils/headers");

async function parseHls(m3u8Url, referer) {
  const response = await axios.get(m3u8Url, {
    headers: getMediaHeaders(referer || m3u8Url),
    timeout: 15000,
  });
  const content = response.data;
  const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf("/") + 1);

  if (content.includes("#EXT-X-STREAM-INF")) {
    return parseMasterPlaylist(content, baseUrl, m3u8Url);
  } else {
    const segments = parseMediaPlaylist(content, baseUrl);
    return {
      isMaster: false,
      qualities: [{ id: "hls_default", quality: "Auto", bandwidth: 0, url: m3u8Url, segments }],
    };
  }
}

function parseMasterPlaylist(content, baseUrl, masterUrl) {
  const lines = content.split("\n").map((l) => l.trim()).filter((l) => l);
  const qualities = [];
  let currentInfo = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("#EXT-X-STREAM-INF")) {
      const bandwidth = extractAttr(line, "BANDWIDTH") || "0";
      const resolution = extractAttr(line, "RESOLUTION") || "";
      currentInfo = { bandwidth: parseInt(bandwidth), resolution };
    } else if (line && !line.startsWith("#") && currentInfo.bandwidth !== undefined) {
      const variantUrl = resolveUrl(line, baseUrl);
      qualities.push({
        id: `hls_${qualities.length}`,
        quality: formatQuality(currentInfo.resolution, currentInfo.bandwidth),
        bandwidth: currentInfo.bandwidth,
        resolution: currentInfo.resolution,
        url: variantUrl,
        segments: [],
      });
      currentInfo = {};
    }
  }
  qualities.sort((a, b) => b.bandwidth - a.bandwidth);
  return { isMaster: true, qualities };
}

async function fetchMediaPlaylist(variantUrl, referer) {
  const response = await axios.get(variantUrl, {
    headers: getMediaHeaders(referer || variantUrl),
    timeout: 15000,
  });
  const baseUrl = variantUrl.substring(0, variantUrl.lastIndexOf("/") + 1);
  return parseMediaPlaylist(response.data, baseUrl);
}

function parseMediaPlaylist(content, baseUrl) {
  const lines = content.split("\n").map((l) => l.trim()).filter((l) => l);
  const segments = [];
  let currentDuration = 0;

  for (const line of lines) {
    if (line.startsWith("#EXTINF:")) {
      currentDuration = parseFloat(line.replace("#EXTINF:", "").split(",")[0]) || 0;
    } else if (line && !line.startsWith("#")) {
      segments.push({ url: resolveUrl(line, baseUrl), duration: currentDuration });
      currentDuration = 0;
    }
  }
  return segments;
}

function extractAttr(line, attr) {
  const regex = new RegExp(`${attr}=(?:"([^"]*)"|(\\S+?)(?:,|$))`, "i");
  const match = line.match(regex);
  return match ? (match[1] || match[2] || "").trim() : null;
}

function resolveUrl(url, base) {
  try {
    if (url.startsWith("http")) return url;
    return new URL(url, base).href;
  } catch {
    return base + url;
  }
}

function formatQuality(resolution, bandwidth) {
  if (resolution) {
    const height = resolution.split("x")[1] || "";
    if (height) return `${height}p`;
  }
  const bw = parseInt(bandwidth) || 0;
  if (bw > 5000000) return "1080p";
  if (bw > 2500000) return "720p";
  if (bw > 1000000) return "480p";
  if (bw > 500000) return "360p";
  return "360p";
}

module.exports = { parseHls, fetchMediaPlaylist };
