const { generateMosaicPuzzle } = require("./mosaic");
const { generateSketchPuzzle } = require("./sketch");

async function generatePuzzle({ mode, imageBuffer, cols, nColors }) {
  if (mode === "sketch") {
    return generateSketchPuzzle({ imageBuffer, cols });
  }
  return generateMosaicPuzzle({ imageBuffer, cols, nColors });
}

module.exports = { generatePuzzle };
