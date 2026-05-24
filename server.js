const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const path = require("path");

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ── Wynhard 24 pen set ────────────────────────────────────────────────────
const PEN_COLORS = [
  { name: "Black", hex: "#1a1a1a", rgb: [26, 26, 26] },
  { name: "Dark Gray", hex: "#5a5a5a", rgb: [90, 90, 90] },
  { name: "Light Gray", hex: "#b8b8b8", rgb: [184, 184, 184] },
  { name: "Brown", hex: "#7b4a2c", rgb: [123, 74, 44] },
  { name: "Dark Brown", hex: "#4a2510", rgb: [74, 37, 16] },
  { name: "Beige", hex: "#e8d5b0", rgb: [232, 213, 176] },
  { name: "Red", hex: "#e02020", rgb: [224, 32, 32] },
  { name: "Dark Red", hex: "#8b1a1a", rgb: [139, 26, 26] },
  { name: "Pink", hex: "#f48cb0", rgb: [244, 140, 176] },
  { name: "Orange", hex: "#f07820", rgb: [240, 120, 32] },
  { name: "Yellow", hex: "#f5d800", rgb: [245, 216, 0] },
  { name: "Lime Green", hex: "#8bc820", rgb: [139, 200, 32] },
  { name: "Green", hex: "#28a030", rgb: [40, 160, 48] },
  { name: "Dark Green", hex: "#145a1e", rgb: [20, 90, 30] },
  { name: "Teal", hex: "#00a89a", rgb: [0, 168, 154] },
  { name: "Sky Blue", hex: "#60c8f0", rgb: [96, 200, 240] },
  { name: "Blue", hex: "#1868c0", rgb: [24, 104, 192] },
  { name: "Dark Blue", hex: "#0a2d7a", rgb: [10, 45, 122] },
  { name: "Indigo", hex: "#4040a8", rgb: [64, 64, 168] },
  { name: "Violet", hex: "#8040c0", rgb: [128, 64, 192] },
  { name: "Purple", hex: "#b028b0", rgb: [176, 40, 176] },
  { name: "Magenta", hex: "#e030a0", rgb: [224, 48, 160] },
  { name: "White", hex: "#f8f8f5", rgb: [248, 248, 245] },
  { name: "Skin", hex: "#f5c89a", rgb: [245, 200, 154] },
];

// ── Color math ────────────────────────────────────────────────────────────
function rgbToLab(r, g, b) {
  let rr = r / 255,
    gg = g / 255,
    bb = b / 255;
  rr = rr > 0.04045 ? Math.pow((rr + 0.055) / 1.055, 2.4) : rr / 12.92;
  gg = gg > 0.04045 ? Math.pow((gg + 0.055) / 1.055, 2.4) : gg / 12.92;
  bb = bb > 0.04045 ? Math.pow((bb + 0.055) / 1.055, 2.4) : bb / 12.92;
  let x = (rr * 0.4124 + gg * 0.3576 + bb * 0.1805) / 0.95047;
  let y = (rr * 0.2126 + gg * 0.7152 + bb * 0.0722) / 1.0;
  let z = (rr * 0.0193 + gg * 0.1192 + bb * 0.9505) / 1.08883;
  x = x > 0.008856 ? Math.cbrt(x) : 7.787 * x + 16 / 116;
  y = y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116;
  z = z > 0.008856 ? Math.cbrt(z) : 7.787 * z + 16 / 116;
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

function deltaE([r1, g1, b1], [r2, g2, b2]) {
  const [L1, a1, b1_] = rgbToLab(r1, g1, b1);
  const [L2, a2, b2_] = rgbToLab(r2, g2, b2);
  return Math.sqrt((L1 - L2) ** 2 + (a1 - a2) ** 2 + (b1_ - b2_) ** 2);
}

function selectBestPens(pixels, n) {
  const scores = new Array(PEN_COLORS.length).fill(0);
  const step = Math.max(1, Math.floor(pixels.length / 800));
  for (let i = 0; i < pixels.length; i += step) {
    let best = 0,
      bestD = Infinity;
    PEN_COLORS.forEach((pen, j) => {
      const d = deltaE(pixels[i], pen.rgb);
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    });
    scores[best]++;
  }
  const ranked = PEN_COLORS.map((p, i) => ({ i, score: scores[i] })).sort(
    (a, b) => b.score - a.score,
  );
  const chosen = new Set([0, 22]);
  for (const item of ranked) {
    if (chosen.size >= n) break;
    chosen.add(item.i);
  }
  return [...chosen]
    .sort((a, b) => a - b)
    .map((i) => ({ ...PEN_COLORS[i], originalIdx: i }));
}

function nearestPen(rgb, pens) {
  let best = 0,
    bestD = Infinity;
  pens.forEach((pen, i) => {
    const d = deltaE(rgb, pen.rgb);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

// ── Generate puzzle ───────────────────────────────────────────────────────
async function generatePuzzle({ imageBuffer, cols, nColors }) {
  // Preprocess for better color clarity
  const preprocessed = await sharp(imageBuffer)
    .rotate() // correct EXIF orientation
    .normalise() // auto levels / stretch histogram
    .modulate({ saturation: 1.3 }) // boost saturation for vivid colors
    .sharpen({ sigma: 0.8 }) // sharpen edges for cleaner regions
    .toBuffer();

  const meta = await sharp(preprocessed).metadata();
  const aspect = meta.height / meta.width;
  const rows = Math.round(cols * aspect);

  const { data } = await sharp(preprocessed)
    .resize(cols, rows, { fit: "fill", kernel: "lanczos3" })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .toColorspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = [];
  for (let i = 0; i < data.length; i += 3)
    pixels.push([data[i], data[i + 1], data[i + 2]]);

  const activePens = selectBestPens(pixels, nColors);
  const indexed = pixels.map((p) => nearestPen(p, activePens));

  return { indexed, activePens, rows, cols };
}

// ── API endpoint ──────────────────────────────────────────────────────────
app.post("/api/generate", upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    const pageW = Math.max(100, parseFloat(req.body.pageW) || 210);
    const pageH = Math.max(100, parseFloat(req.body.pageH) || 297);
    const margin = Math.max(5, parseFloat(req.body.margin) || 10);
    const cols = Math.min(80, Math.max(10, parseInt(req.body.cols) || 35));
    const nColors = Math.min(24, Math.max(4, parseInt(req.body.nColors) || 16));

    const printableW = pageW - 2 * margin;
    const printableH = pageH - 2 * margin;
    const cellSizeMm = printableW / cols;
    const rowsFit = Math.floor(printableH / cellSizeMm);

    const result = await generatePuzzle({
      imageBuffer: req.file.buffer,
      cols,
      nColors,
    });

    res.json({
      indexed: result.indexed,
      activePens: result.activePens,
      rows: result.rows,
      cols: result.cols,
      cellSizeMm,
      pageW,
      pageH,
      margin,
      printableW,
      printableH,
      rowsFit,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`\n  Color-by-Number Maker running → http://localhost:${PORT}\n`),
);
