const { PEN_COLORS } = require("../config/pens");

function rgbToLab(r, g, b) {
  let rr = r / 255;
  let gg = g / 255;
  let bb = b / 255;
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
  for (let i = 0; i < pixels.length; i++) {
    let best = 0;
    let bestDistance = Infinity;
    PEN_COLORS.forEach((pen, j) => {
      const distance = deltaE(pixels[i], pen.rgb);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = j;
      }
    });
    scores[best]++;
  }

  const ranked = PEN_COLORS.map((pen, i) => ({ i, score: scores[i] })).sort(
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
  let best = 0;
  let bestDistance = Infinity;
  pens.forEach((pen, i) => {
    const distance = deltaE(rgb, pen.rgb);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  });
  return best;
}

module.exports = { nearestPen, selectBestPens };
