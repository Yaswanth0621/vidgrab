/**
 * DASH Parser — parses .mpd manifest files
 */
const axios = require("axios");
const { XMLParser } = require("fast-xml-parser");
const { getMediaHeaders } = require("../utils/headers");

async function parseDash(mpdUrl, referer) {
  const response = await axios.get(mpdUrl, {
    headers: getMediaHeaders(referer || mpdUrl),
    timeout: 15000,
  });

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const result = parser.parse(response.data);
  const mpd = result.MPD || result.mpd;
  if (!mpd) throw new Error("Invalid MPD manifest");

  const baseUrl = mpdUrl.substring(0, mpdUrl.lastIndexOf("/") + 1);
  const periods = Array.isArray(mpd.Period) ? mpd.Period : [mpd.Period];
  const formats = [];

  for (const period of periods) {
    if (!period) continue;
    const adaptations = Array.isArray(period.AdaptationSet) ? period.AdaptationSet : [period.AdaptationSet];

    for (const adaptation of adaptations) {
      if (!adaptation) continue;
      const contentType = adaptation["@_contentType"] || adaptation["@_mimeType"] || "";
      const isVideo = contentType.includes("video") || adaptation["@_id"] === "video";
      const isAudio = contentType.includes("audio");

      const representations = Array.isArray(adaptation.Representation)
        ? adaptation.Representation
        : [adaptation.Representation];

      for (const rep of representations) {
        if (!rep) continue;
        const bandwidth = parseInt(rep["@_bandwidth"] || "0");
        const width = rep["@_width"] || "";
        const height = rep["@_height"] || "";
        const mimeType = rep["@_mimeType"] || contentType;
        const id = rep["@_id"] || `dash_${formats.length}`;

        // Get segment template or base URL
        let segmentUrl = null;
        if (rep.BaseURL) {
          segmentUrl = resolveUrl(String(rep.BaseURL), baseUrl);
        } else if (adaptation.BaseURL) {
          segmentUrl = resolveUrl(String(adaptation.BaseURL), baseUrl);
        }

        formats.push({
          id: `dash_${id}`,
          type: isVideo ? "dash_video" : isAudio ? "dash_audio" : "dash",
          quality: height ? `${height}p` : formatBandwidth(bandwidth),
          bandwidth,
          width,
          height,
          mimeType,
          url: mpdUrl,
          segmentUrl,
          representationId: id,
        });
      }
    }
  }

  // Sort video by bandwidth desc
  const videos = formats.filter((f) => f.type === "dash_video").sort((a, b) => b.bandwidth - a.bandwidth);
  const audio = formats.filter((f) => f.type === "dash_audio");
  const other = formats.filter((f) => f.type === "dash");

  return { qualities: [...videos, ...audio, ...other], mpdUrl };
}

function resolveUrl(url, base) {
  try {
    if (url.startsWith("http")) return url;
    return new URL(url, base).href;
  } catch {
    return base + url;
  }
}

function formatBandwidth(bw) {
  if (bw > 5000000) return "1080p";
  if (bw > 2500000) return "720p";
  if (bw > 1000000) return "480p";
  if (bw > 500000) return "360p";
  return "Auto";
}

module.exports = { parseDash };
