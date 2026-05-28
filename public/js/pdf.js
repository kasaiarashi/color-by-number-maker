import { fileToDataUrl, loadImageMeta } from "./api.js";
import { dom } from "./dom.js";
import { getRowsPerPage } from "./render.js";
import { state } from "./state.js";

function getImagePlacement(data) {
    const topMarginExtra = data.pageLabel ? 4 : 0;
    const maxW = data.printableW;
    const maxH = data.printableH - topMarginExtra;
    const aspect = data.imageAspectRatio || data.rows / Math.max(1, data.cols);
    let width = maxW;
    let height = width * aspect;
    if (height > maxH) {
        height = maxH;
        width = height / aspect;
    }
    return {
        x: data.margin + (data.printableW - width) / 2,
        y: data.margin + topMarginExtra,
        width,
        height,
    };
}

export function makeGridCanvas(data, mode, startRow, rowCount) {
    if (data.renderMode === "image") {
        return null;
    }
    const pxPerMm = 150 / 25.4;
    const cellPx = Math.max(8, Math.round(data.cellSizeMm * pxPerMm));
    const borderPx = Math.max(2, Math.round(data.borderMm * pxPerMm));
    const width = data.cols * cellPx;
    const height = rowCount * cellPx;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    if (mode === "answer") {
        for (let r = 0; r < rowCount; r++) {
            for (let c = 0; c < data.cols; c++) {
                const idx = data.indexed[(startRow + r) * data.cols + c];
                ctx.fillStyle = data.activePens[idx].hex;
                ctx.fillRect(c * cellPx, r * cellPx, cellPx, cellPx);
            }
        }
    } else {
        const fontSize = Math.max(5, Math.round(cellPx * 0.5));
        ctx.font = `${fontSize}px DM Mono, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(0,0,0,0.28)";
        for (let r = 0; r < rowCount; r++) {
            for (let c = 0; c < data.cols; c++) {
                const idx = data.indexed[(startRow + r) * data.cols + c];
                ctx.fillText(idx + 1, c * cellPx + cellPx / 2, r * cellPx + cellPx / 2);
            }
        }
    }

    ctx.strokeStyle = mode === "answer" ? "rgba(0,0,0,0.2)" : "rgba(140,130,120,1)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let r = 0; r <= rowCount; r++) {
        ctx.moveTo(0, r * cellPx);
        ctx.lineTo(width, r * cellPx);
    }
    for (let c = 0; c <= data.cols; c++) {
        ctx.moveTo(c * cellPx, 0);
        ctx.lineTo(c * cellPx, height);
    }
    ctx.stroke();

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = borderPx;
    ctx.strokeRect(0, 0, width, height);
    return canvas;
}

function addLegend(pdf, data, yStart) {
    if (data.generatorMode === "sketch") return;
    const perLegRow = Math.max(1, Math.floor(data.printableW / 34));
    const swatchSz = 4.5;
    pdf.setFontSize(6);
    pdf.setTextColor(120, 110, 100);
    pdf.text("Color Key:", data.margin, yStart + 5);
    data.activePens.forEach((pen, i) => {
        const col = i % perLegRow;
        const row = Math.floor(i / perLegRow);
        const lx = data.margin + col * 34;
        const ly = yStart + 10 + row * 7;
        const [r, g, b] = pen.rgb;
        pdf.setFillColor(r, g, b);
        pdf.setDrawColor(80, 70, 60);
        pdf.setLineWidth(0.15);
        pdf.rect(lx, ly, swatchSz, swatchSz, "FD");
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const tc = lum > 145 ? 40 : 255;
        pdf.setTextColor(tc, tc, tc);
        pdf.setFontSize(3.5);
        pdf.text(String(i + 1), lx + swatchSz / 2, ly + swatchSz - 0.5, { align: "center" });
        pdf.setTextColor(50, 40, 30);
        pdf.setFontSize(5.5);
        pdf.text(pen.name, lx + swatchSz + 1.5, ly + swatchSz - 0.5);
    });
}

function addFooter(pdf, data, text) {
    pdf.setFontSize(5);
    pdf.setTextColor(180, 170, 160);
    pdf.text(text, data.margin, data.pageH - data.margin * 0.5);
}

export function addGridPages(pdf, data, mode, isFirstPage) {
    if (data.renderMode === "image") {
        if (!isFirstPage) {
            pdf.addPage([data.pageW, data.pageH], data.pageW >= data.pageH ? "landscape" : "portrait");
        }
        const placement = getImagePlacement(data);
        if (data.pageLabel) {
            pdf.setFontSize(9);
            pdf.setTextColor(40, 30, 20);
            pdf.text(data.pageLabel, data.pageW / 2, data.margin * 0.65, {
                align: "center",
            });
        }
        const imageData =
            mode === "answer" ? data.answerImageDataUrl : data.drawableImageDataUrl;
        pdf.addImage(
            imageData,
            "PNG",
            placement.x,
            placement.y,
            placement.width,
            placement.height,
        );
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(Math.max(0.3, data.borderMm));
        pdf.rect(placement.x, placement.y, placement.width, placement.height);
        addFooter(pdf, data, mode === "blank" ? "Drawing Guide" : "Colored Reference");
        return;
    }

    const rowsPerPage = getRowsPerPage(data);
    const totalPages = Math.ceil(data.rows / rowsPerPage);
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
        if (!(isFirstPage && pageIndex === 0)) {
            pdf.addPage([data.pageW, data.pageH], data.pageW >= data.pageH ? "landscape" : "portrait");
        }

        const startRow = pageIndex * rowsPerPage;
        const rowCount = Math.min(rowsPerPage, data.rows - startRow);
        const topMarginExtra = data.pageLabel ? 4 : 0;
        const y = data.margin + topMarginExtra;
        const canvas = makeGridCanvas(data, mode, startRow, rowCount);
        const imgData = canvas.toDataURL("image/png");

        if (data.pageLabel) {
            const pageSuffix = totalPages > 1 ? ` (${pageIndex + 1}/${totalPages})` : "";
            pdf.setFontSize(9);
            pdf.setTextColor(40, 30, 20);
            pdf.text(`${data.pageLabel}${pageSuffix}`, data.pageW / 2, data.margin * 0.65, {
                align: "center",
            });
        }

        pdf.addImage(imgData, "PNG", data.margin, y, data.cols * data.cellSizeMm, rowCount * data.cellSizeMm);

        if (data.generatorMode === "mosaic" && pageIndex === totalPages - 1) {
            const usedBottom = y + rowCount * data.cellSizeMm;
            const legendRows = Math.ceil(data.activePens.length / Math.max(1, Math.floor(data.printableW / 34)));
            const legendH = 10 + legendRows * 7;
            const spaceBelow = data.pageH - usedBottom - data.margin;
            if (spaceBelow >= legendH + 2) {
                addLegend(pdf, data, usedBottom + 2);
            }
        }

        addFooter(pdf, data, mode === "blank" ? "Color by Number" : "Answer Key");
    }
}

function makeAnswerThumbnail(data) {
    if (data.renderMode === "image") {
        return {
            dataUrl: data.answerImageDataUrl,
            aspect: data.imageAspectRatio,
            format: "PNG",
        };
    }
    return makeGridCanvas(data, "answer", 0, data.rows);
}

async function makeAnswerSheetImage(puzzle, file, mode) {
    if (mode === "generated") {
        const thumb = makeAnswerThumbnail(puzzle);
        if (puzzle.renderMode === "image") {
            return thumb;
        }
        return {
            dataUrl: thumb.toDataURL("image/png"),
            format: "PNG",
            aspect: puzzle.rows / puzzle.cols,
        };
    }
    const dataUrl = await fileToDataUrl(file);
    const meta = await loadImageMeta(dataUrl);
    const format = dataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
    return {
        dataUrl,
        format,
        aspect: meta.height / meta.width,
    };
}

export async function addAnswerSheet(pdf, puzzles, files, isFirstPage, mode) {
    if (!puzzles.length) return;
    const sample = puzzles[0];
    const orientation = sample.pageW >= sample.pageH ? "landscape" : "portrait";
    if (!isFirstPage) {
        pdf.addPage([sample.pageW, sample.pageH], orientation);
    }

    const colsPerRow = sample.pageW > sample.pageH ? 3 : 2;
    const gap = 6;
    const cardW = (sample.printableW - gap * (colsPerRow - 1)) / colsPerRow;
    const topY = sample.margin + 18;
    let x = sample.margin;
    let y = topY;
    let col = 0;

    const drawHeader = () => {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.setTextColor(30, 24, 18);
        pdf.text("Answers", sample.pageW / 2, sample.margin, { align: "center" });
        pdf.setFont("helvetica", "normal");
    };

    drawHeader();

    for (let i = 0; i < puzzles.length; i++) {
        const puzzle = puzzles[i];
        const imageData = await makeAnswerSheetImage(puzzle, files[i], mode);
        const imgH = Math.min(cardW * imageData.aspect, 52);
        const cardH = 10 + imgH;

        if (y + cardH > sample.pageH - sample.margin) {
            pdf.addPage([sample.pageW, sample.pageH], orientation);
            drawHeader();
            x = sample.margin;
            y = topY;
            col = 0;
        }

        pdf.setFontSize(8);
        pdf.setTextColor(50, 40, 30);
        pdf.text(`${i + 1}. ${puzzle.pageLabel}`, x, y + 4.5);
        pdf.addImage(imageData.dataUrl, imageData.format, x, y + 7, cardW, imgH);
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.5);
        pdf.rect(x, y + 7, cardW, imgH);

        col++;
        if (col >= colsPerRow) {
            col = 0;
            x = sample.margin;
            y += cardH + gap;
        } else {
            x += cardW + gap;
        }
    }
}

export async function buildPdfForCurrent(opts) {
    if (!state.lastData) return;
    await document.fonts.ready;
    const { jsPDF } = window.jspdf;
    const orientation = state.lastData.pageW >= state.lastData.pageH ? "landscape" : "portrait";
    const pdf = new jsPDF({
        orientation,
        unit: "mm",
        format: [state.lastData.pageW, state.lastData.pageH],
    });

    let first = true;
    if (opts.blank) {
        addGridPages(pdf, state.lastData, "blank", first);
        first = false;
    }
    if (opts.answer) {
        addGridPages(pdf, state.lastData, "answer", first);
    }

    pdf.save(`${state.lastData.pageLabel || "puzzle"}.pdf`);
}

export async function buildBatchPdf(requestPuzzle) {
    if (!state.selectedFiles.length) return;
    await document.fonts.ready;
    const { jsPDF } = window.jspdf;
    const puzzles = [];

    for (let i = 0; i < state.selectedFiles.length; i++) {
        const puzzle = await requestPuzzle(
            state.selectedFiles[i],
            i,
            dom.pageLabel.value,
        );
        puzzles.push(puzzle);
        dom.progressBar.style.width = `${10 + ((i + 1) / state.selectedFiles.length) * 55}%`;
    }

    const firstPuzzle = puzzles[0];
    const orientation = firstPuzzle.pageW >= firstPuzzle.pageH ? "landscape" : "portrait";
    const pdf = new jsPDF({
        orientation,
        unit: "mm",
        format: [firstPuzzle.pageW, firstPuzzle.pageH],
    });

    let first = true;
    puzzles.forEach((puzzle, index) => {
        addGridPages(pdf, puzzle, "blank", first);
        first = false;
        dom.progressBar.style.width = `${68 + ((index + 1) / puzzles.length) * 20}%`;
    });

    await addAnswerSheet(pdf, puzzles, state.selectedFiles, first, dom.answerSheetModeInput.value);
    dom.progressBar.style.width = "100%";

    const base = dom.pageLabel.value.trim() || "color-by-number-batch";
    pdf.save(`${base}.pdf`);
}
