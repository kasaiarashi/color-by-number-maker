const sharp = require("sharp");
const { nearestPen, selectBestPens } = require("../utils/colorMath");

async function generateMosaicPuzzle({ imageBuffer, cols, nColors }) {
  const preprocessed = await sharp(imageBuffer)
    .rotate()
    .normalise()
    .modulate({ saturation: 1.1 })
    .toBuffer();

  const meta = await sharp(preprocessed).metadata();
  const rows = Math.round(cols * (meta.height / meta.width));

  const { data } = await sharp(preprocessed)
    .resize(cols, rows, { fit: "fill", kernel: "lanczos3" })
    .median(3)
    .median(3)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .toColorspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = [];
  for (let i = 0; i < data.length; i += 3) {
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }

  const activePens = selectBestPens(pixels, nColors);
  const grid = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => pixels[r * cols + c].slice()),
  );
  const indexed = [];
  const dither = 0.12;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = grid[r][c];
      const penIdx = nearestPen(px, activePens);
      indexed.push(penIdx);
      const pen = activePens[penIdx];
      const eR = (px[0] - pen.rgb[0]) * dither;
      const eG = (px[1] - pen.rgb[1]) * dither;
      const eB = (px[2] - pen.rgb[2]) * dither;
      for (const [nr, nc, factor] of [
        [r, c + 1, 7 / 16],
        [r + 1, c - 1, 3 / 16],
        [r + 1, c, 5 / 16],
        [r + 1, c + 1, 1 / 16],
      ]) {
        if (nr < rows && nc >= 0 && nc < cols) {
          grid[nr][nc][0] = Math.max(0, Math.min(255, grid[nr][nc][0] + eR * factor));
          grid[nr][nc][1] = Math.max(0, Math.min(255, grid[nr][nc][1] + eG * factor));
          grid[nr][nc][2] = Math.max(0, Math.min(255, grid[nr][nc][2] + eB * factor));
        }
      }
    }
  }

  for (let pass = 0; pass < 4; pass++) {
    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < cols - 1; c++) {
        const i = r * cols + c;
        const current = indexed[i];
        const neighbours = [
          indexed[(r - 1) * cols + (c - 1)],
          indexed[(r - 1) * cols + c],
          indexed[(r - 1) * cols + (c + 1)],
          indexed[r * cols + (c - 1)],
          indexed[r * cols + (c + 1)],
          indexed[(r + 1) * cols + (c - 1)],
          indexed[(r + 1) * cols + c],
          indexed[(r + 1) * cols + (c + 1)],
        ];
        if (neighbours.filter((n) => n === current).length <= 1) {
          const freq = {};
          neighbours.forEach((n) => {
            freq[n] = (freq[n] || 0) + 1;
          });
          indexed[i] = +Object.keys(freq).reduce((a, b) =>
            freq[a] > freq[b] ? a : b,
          );
        }
      }
    }
  }

  return {
    generatorMode: "mosaic",
    renderMode: "grid",
    indexed,
    activePens,
    rows,
    cols,
  };
}

module.exports = { generateMosaicPuzzle };
