const express = require("express");
const multer = require("multer");
const { generatePuzzle } = require("../generators");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.post("/", upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    const pageW = Math.max(100, parseFloat(req.body.pageW) || 210);
    const pageH = Math.max(100, parseFloat(req.body.pageH) || 297);
    const margin = Math.max(12, parseFloat(req.body.margin) || 12);
    const cols = Math.min(80, Math.max(10, parseInt(req.body.cols, 10) || 35));
    const nColors = Math.min(
      24,
      Math.max(4, parseInt(req.body.nColors, 10) || 16),
    );
    const borderMm = Math.max(0, parseFloat(req.body.borderMm) || 1.2);
    const generatorMode =
      req.body.generatorMode === "sketch" ? "sketch" : "mosaic";

    const printableW = pageW - 2 * margin;
    const printableH = pageH - 2 * margin;
    const cellSizeMm = printableW / cols;
    const rowsFit = Math.floor(printableH / cellSizeMm);

    const result = await generatePuzzle({
      mode: generatorMode,
      imageBuffer: req.file.buffer,
      cols,
      nColors,
    });

    res.json({
      ...result,
      cellSizeMm,
      pageW,
      pageH,
      margin,
      borderMm,
      printableW,
      printableH,
      rowsFit,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
