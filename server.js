const express = require('express');
const multer  = require('multer');
const sharp   = require('sharp');
const path    = require('path');

const app    = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Wynhard 24 pen set ────────────────────────────────────────────────────
const PEN_COLORS = [
  { name: 'Black',      hex: '#1a1a1a', rgb: [26,  26,  26]  },
  { name: 'Dark Gray',  hex: '#5a5a5a', rgb: [90,  90,  90]  },
  { name: 'Light Gray', hex: '#b8b8b8', rgb: [184, 184, 184] },
  { name: 'Brown',      hex: '#7b4a2c', rgb: [123, 74,  44]  },
  { name: 'Dark Brown', hex: '#4a2510', rgb: [74,  37,  16]  },
  { name: 'Beige',      hex: '#e8d5b0', rgb: [232, 213, 176] },
  { name: 'Red',        hex: '#e02020', rgb: [224, 32,  32]  },
  { name: 'Dark Red',   hex: '#8b1a1a', rgb: [139, 26,  26]  },
  { name: 'Pink',       hex: '#f48cb0', rgb: [244, 140, 176] },
  { name: 'Orange',     hex: '#f07820', rgb: [240, 120, 32]  },
  { name: 'Yellow',     hex: '#f5d800', rgb: [245, 216, 0]   },
  { name: 'Lime Green', hex: '#8bc820', rgb: [139, 200, 32]  },
  { name: 'Green',      hex: '#28a030', rgb: [40,  160, 48]  },
  { name: 'Dark Green', hex: '#145a1e', rgb: [20,  90,  30]  },
  { name: 'Teal',       hex: '#00a89a', rgb: [0,   168, 154] },
  { name: 'Sky Blue',   hex: '#60c8f0', rgb: [96,  200, 240] },
  { name: 'Blue',       hex: '#1868c0', rgb: [24,  104, 192] },
  { name: 'Dark Blue',  hex: '#0a2d7a', rgb: [10,  45,  122] },
  { name: 'Indigo',     hex: '#4040a8', rgb: [64,  64,  168] },
  { name: 'Violet',     hex: '#8040c0', rgb: [128, 64,  192] },
  { name: 'Purple',     hex: '#b028b0', rgb: [176, 40,  176] },
  { name: 'Magenta',    hex: '#e030a0', rgb: [224, 48,  160] },
  { name: 'White',      hex: '#f8f8f5', rgb: [248, 248, 245] },
  { name: 'Skin',       hex: '#f5c89a', rgb: [245, 200, 154] },
];

// ── Color math ────────────────────────────────────────────────────────────
function rgbToLab(r, g, b) {
  let rr = r/255, gg = g/255, bb = b/255;
  rr = rr > 0.04045 ? Math.pow((rr+0.055)/1.055, 2.4) : rr/12.92;
  gg = gg > 0.04045 ? Math.pow((gg+0.055)/1.055, 2.4) : gg/12.92;
  bb = bb > 0.04045 ? Math.pow((bb+0.055)/1.055, 2.4) : bb/12.92;
  let x=(rr*0.4124+gg*0.3576+bb*0.1805)/0.95047;
  let y=(rr*0.2126+gg*0.7152+bb*0.0722)/1.0;
  let z=(rr*0.0193+gg*0.1192+bb*0.9505)/1.08883;
  x=x>0.008856?Math.cbrt(x):7.787*x+16/116;
  y=y>0.008856?Math.cbrt(y):7.787*y+16/116;
  z=z>0.008856?Math.cbrt(z):7.787*z+16/116;
  return [116*y-16, 500*(x-y), 200*(y-z)];
}

function deltaE([r1,g1,b1], [r2,g2,b2]) {
  const [L1,a1,b1_]=rgbToLab(r1,g1,b1);
  const [L2,a2,b2_]=rgbToLab(r2,g2,b2);
  return Math.sqrt((L1-L2)**2+(a1-a2)**2+(b1_-b2_)**2);
}

function selectBestPens(pixels, n) {
  const scores = new Array(PEN_COLORS.length).fill(0);
  const step = Math.max(1, Math.floor(pixels.length / 800));
  for (let i = 0; i < pixels.length; i += step) {
    let best=0, bestD=Infinity;
    PEN_COLORS.forEach((pen,j) => {
      const d = deltaE(pixels[i], pen.rgb);
      if (d < bestD) { bestD=d; best=j; }
    });
    scores[best]++;
  }
  const ranked = PEN_COLORS.map((p,i) => ({ i, score: scores[i] })).sort((a,b)=>b.score-a.score);
  const chosen = new Set([0, 22]); // always black + white
  for (const item of ranked) {
    if (chosen.size >= n) break;
    chosen.add(item.i);
  }
  return [...chosen].sort((a,b)=>a-b).map(i => ({ ...PEN_COLORS[i], originalIdx: i }));
}

function nearestPen(rgb, pens) {
  let best=0, bestD=Infinity;
  pens.forEach((pen,i) => {
    const d = deltaE(rgb, pen.rgb);
    if (d < bestD) { bestD=d; best=i; }
  });
  return best;
}

// ── Generate puzzle (returns pixel buffers) ───────────────────────────────
async function generatePuzzle({ imageBuffer, cols, nColors, cellSize }) {
  const img    = sharp(imageBuffer);
  const meta   = await img.metadata();
  const aspect = meta.height / meta.width;
  const rows   = Math.round(cols * aspect);

  // Resize to grid
  const { data } = await img.resize(cols, rows, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });

  const pixels = [];
  for (let i = 0; i < data.length; i += 3) pixels.push([data[i], data[i+1], data[i+2]]);

  const activePens = selectBestPens(pixels, nColors);
  const indexed    = pixels.map(p => nearestPen(p, activePens));

  const cw = cols * cellSize;
  const ch = rows * cellSize;

  // Build raw RGBA buffers for blank + answer
  const blankBuf  = Buffer.alloc(cw * ch * 4, 255);
  const answerBuf = Buffer.alloc(cw * ch * 4, 255);

  // Grid lines color
  const gridA = 40; // alpha for grid lines

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const pidx = indexed[r * cols + c];
      const pen  = activePens[pidx];

      for (let py = 0; py < cellSize; py++) {
        for (let px = 0; px < cellSize; px++) {
          const imgX = c * cellSize + px;
          const imgY = r * cellSize + py;
          const off  = (imgY * cw + imgX) * 4;

          const isBorder = px === 0 || py === 0;

          // Answer: fill with pen color, thin grid lines
          if (isBorder) {
            answerBuf[off]   = 0;
            answerBuf[off+1] = 0;
            answerBuf[off+2] = 0;
            answerBuf[off+3] = gridA;
          } else {
            answerBuf[off]   = pen.rgb[0];
            answerBuf[off+1] = pen.rgb[1];
            answerBuf[off+2] = pen.rgb[2];
            answerBuf[off+3] = 255;
          }

          // Blank: white cells with grid lines, no numbers here (drawn via SVG overlay in browser)
          if (isBorder) {
            blankBuf[off]   = 180;
            blankBuf[off+1] = 170;
            blankBuf[off+2] = 160;
            blankBuf[off+3] = 255;
          } else {
            blankBuf[off]   = 255;
            blankBuf[off+1] = 255;
            blankBuf[off+2] = 255;
            blankBuf[off+3] = 255;
          }
        }
      }
    }
  }

  const blankPng  = await sharp(blankBuf,  { raw: { width: cw, height: ch, channels: 4 } }).png().toBuffer();
  const answerPng = await sharp(answerBuf, { raw: { width: cw, height: ch, channels: 4 } }).png().toBuffer();

  return { blankPng, answerPng, indexed, activePens, rows, cols, cellSize, cw, ch };
}

// ── API endpoint ──────────────────────────────────────────────────────────
app.post('/api/generate', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const cols     = Math.min(60, Math.max(15, parseInt(req.body.cols)     || 35));
    const nColors  = Math.min(24, Math.max(4,  parseInt(req.body.nColors)  || 16));
    const cellSize = Math.min(20, Math.max(8,  parseInt(req.body.cellSize) || 14));

    const result = await generatePuzzle({ imageBuffer: req.file.buffer, cols, nColors, cellSize });

    res.json({
      blank:      result.blankPng.toString('base64'),
      answer:     result.answerPng.toString('base64'),
      indexed:    result.indexed,
      activePens: result.activePens,
      rows:       result.rows,
      cols:       result.cols,
      cellSize:   result.cellSize,
      cw:         result.cw,
      ch:         result.ch,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`\n  Color-by-Number Maker running → http://localhost:${PORT}\n`));
