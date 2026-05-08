const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");

const analyzeRouter = require("./routes/analyze");
const downloadRouter = require("./routes/download");

const app = express();

// CORS — allow Firebase Hosting domain
app.use(cors({ origin: true }));
app.use(express.json({ limit: "10mb" }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "VidGrab API", version: "1.0.0" });
});

// Routes
app.use("/analyze", analyzeRouter);
app.use("/download", downloadRouter);

// Error handler
app.use((err, req, res, next) => {
  console.error("[VidGrab Error]", err);
  res.status(500).json({
    error: "Internal server error",
    message: err.message || "Something went wrong",
  });
});

// Export as Firebase Function (Gen 1 for broad compatibility)
exports.api = functions
  .runWith({
    timeoutSeconds: 540,
    memory: "2GB",
  })
  .https.onRequest(app);
