const sharp = require("sharp");

async function generateSketchPuzzle({ imageBuffer, cols }) {
  const targetWidth = Math.max(900, cols * 36);
  const oriented = sharp(imageBuffer).rotate();
  const meta = await oriented.metadata();
  const aspectRatio = meta.height / meta.width;
  const targetHeight = Math.round(targetWidth * aspectRatio);

  const resized = oriented.resize(targetWidth, targetHeight, {
    fit: "fill",
    kernel: "lanczos3",
  });

  const edgeMask = await resized
    .clone()
    .greyscale()
    .normalise()
    .blur(0.6)
    .convolve({
      width: 3,
      height: 3,
      kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1],
    })
    .normalise()
    .threshold(28, { grayscale: true })
    .negate()
    .linear(0.85, 0)
    .png()
    .toBuffer();

  const drawableBuffer = await sharp({
    create: {
      width: targetWidth,
      height: targetHeight,
      channels: 4,
      background: { r: 252, g: 248, b: 241, alpha: 1 },
    },
  })
    .composite([
      {
        input: edgeMask,
        blend: "multiply",
      },
    ])
    .png()
    .toBuffer();

  const colorBase = await resized
    .clone()
    .normalise()
    .modulate({ brightness: 1.03, saturation: 1.18 })
    .median(1)
    .sharpen({ sigma: 1.1, m1: 1.4, m2: 2.2 })
    .png()
    .toBuffer();

  const coloredBuffer = await sharp(colorBase)
    .composite([
      {
        input: edgeMask,
        blend: "multiply",
      },
    ])
    .png()
    .toBuffer();

  return {
    generatorMode: "sketch",
    renderMode: "image",
    indexed: [],
    activePens: [],
    rows: Math.round(cols * aspectRatio),
    cols,
    imageAspectRatio: aspectRatio,
    drawableImageDataUrl: `data:image/png;base64,${drawableBuffer.toString("base64")}`,
    answerImageDataUrl: `data:image/png;base64,${coloredBuffer.toString("base64")}`,
  };
}

module.exports = { generateSketchPuzzle };
