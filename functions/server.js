const express = require("express");
const cors = require("cors");
const analyzeRouter = require("./src/routes/analyze");
const downloadRouter = require("./src/routes/download");

const app = express();
const PORT = process.env.PORT || 10000;

// CORS — Allow frontend access
app.use(cors({
  origin: "*", // Allows any frontend to connect. For security, change to your specific frontend URL later.
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json({ limit: "10mb" }));

// Health check route
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "VidGrab Backend", version: "1.0.0" });
});

// API Routes
app.use("/api/analyze", analyzeRouter);
app.use("/api/download", downloadRouter);

// Error handler
app.use((err, req, res, next) => {
  console.error("[VidGrab Error]", err);
  res.status(500).json({
    error: "Internal server error",
    message: err.message || "Something went wrong",
  });
});

app.listen(PORT, () => {
  console.log(`VidGrab backend is running on port ${PORT}`);
});
