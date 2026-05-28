const PAGE_SIZES = {
    a4p: { w: 210, h: 297 },
    a4l: { w: 297, h: 210 },
    ltp: { w: 215.9, h: 279.4 },
    ltl: { w: 279.4, h: 215.9 },
    a3p: { w: 297, h: 420 },
};

const MARGIN_MM = 12;
const DEFAULT_BORDER_MM = 1.2;
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

const strip = document.getElementById("paletteStrip");
const fileInput = document.getElementById("fileInput");
const dropzone = document.getElementById("dropzone");
const thumb = document.getElementById("thumb");
const generateBtn = document.getElementById("generateBtn");
const fileMeta = document.getElementById("fileMeta");
const fileList = document.getElementById("fileList");
const borderInput = document.getElementById("borderMm");
const answerSheetModeInput = document.getElementById("answerSheetMode");

let currentTab = "blank";
let lastData = null;
let selectedFiles = [];
let currentFileIndex = 0;
let currentThumbUrl = null;
const puzzleCache = new Map();

PEN_COLORS.forEach((c, i) => {
    const d = document.createElement("div");
    d.className = "pdot";
    d.style.background = c.hex;
    d.innerHTML = `<span class="tip">${i + 1}. ${c.name}</span>`;
    strip.appendChild(d);
});

[
    ["colsSlider", "colsVal"],
    ["colorsSlider", "colorsVal"],
].forEach(([sid, vid]) => {
    const s = document.getElementById(sid);
    const v = document.getElementById(vid);
    s.addEventListener("input", () => {
        v.textContent = s.value;
        updateCellChip();
    });
});

document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
        document
            .querySelectorAll(".tab")
            .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentTab = btn.dataset.tab;
        updateTabView();
    });
});

function getPageDims() {
    const key = document.getElementById("pageSizeSelect").value;
    return PAGE_SIZES[key] || PAGE_SIZES.a4p;
}

function getSettings() {
    const ps = getPageDims();
    return {
        cols: parseInt(document.getElementById("colsSlider").value) || 35,
        nColors: parseInt(document.getElementById("colorsSlider").value) || 16,
        borderMm: Math.max(
            0,
            parseFloat(borderInput.value) || DEFAULT_BORDER_MM,
        ),
        pageW: ps.w,
        pageH: ps.h,
    };
}

function updateCellChip() {
    const ps = getPageDims();
    const cols = parseInt(document.getElementById("colsSlider").value) || 35;
    const cellMm = (ps.w - 2 * MARGIN_MM) / cols;
    const borderMm = Math.max(0, parseFloat(borderInput.value) || 0);
    document.getElementById("cellChip").textContent =
        `Cell: ${cellMm.toFixed(1)} mm · Border: ${borderMm.toFixed(1)} mm · ${ps.w}×${ps.h} mm page`;
}

function setStatus(msg, type = "") {
    const el = document.getElementById("status");
    el.textContent = msg;
    el.className = "status" + (type ? ` ${type}` : "");
}

function animateProgress() {
    const bar = document.getElementById("progressBar");
    let w = 0;
    const iv = setInterval(() => {
        w = Math.min(w + Math.random() * 8, 88);
        bar.style.width = `${w}%`;
        if (w >= 88) clearInterval(iv);
    }, 120);
}

function setBusy(isBusy) {
    generateBtn.disabled = isBusy || selectedFiles.length === 0;
    document.getElementById("dlAllBtn").disabled =
        isBusy || selectedFiles.length === 0;
    document.getElementById("btnText").style.display = isBusy ? "none" : "";
    document.getElementById("spinner").style.display = isBusy ? "block" : "none";
    document.getElementById("progressWrap").style.display = isBusy
        ? "block"
        : "none";
    if (!isBusy) {
        document.getElementById("progressBar").style.width = "0%";
    }
}

function getFileCacheKey(file, settings) {
    return JSON.stringify({
        n: file.name,
        s: file.size,
        m: file.lastModified,
        c: settings.cols,
        k: settings.nColors,
        p: settings.pageW,
        q: settings.pageH,
        b: settings.borderMm,
    });
}

function defaultLabelForFile(file, index, total) {
    const base = document.getElementById("pageLabel").value.trim();
    if (base && total > 1) return `${base} ${index + 1}`;
    if (base) return base;
    return file.name.replace(/\.[^.]+$/, "");
}

function updateFileThumb() {
    if (currentThumbUrl) {
        URL.revokeObjectURL(currentThumbUrl);
        currentThumbUrl = null;
    }
    const currentFile = selectedFiles[currentFileIndex];
    if (!currentFile) {
        thumb.style.display = "none";
        thumb.removeAttribute("src");
        return;
    }
    currentThumbUrl = URL.createObjectURL(currentFile);
    thumb.src = currentThumbUrl;
    thumb.style.display = "block";
}

function renderFileList() {
    fileList.innerHTML = "";
    if (selectedFiles.length === 0) {
        fileMeta.textContent = "No images selected.";
        generateBtn.disabled = true;
        document.getElementById("dlAllBtn").disabled = true;
        return;
    }

    fileMeta.textContent = `${selectedFiles.length} image${selectedFiles.length > 1 ? "s" : ""} selected. Preview uses the current image. Batch PDF uses all of them.`;
    selectedFiles.forEach((file, index) => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "file-pill" + (index === currentFileIndex ? " active" : "");
        el.innerHTML = `<span>${index + 1}. ${file.name}</span><span>${(file.size / 1024 / 1024).toFixed(1)} MB</span>`;
        el.addEventListener("click", async () => {
            currentFileIndex = index;
            updateFileThumb();
            renderFileList();
            const current = selectedFiles[currentFileIndex];
            const settings = getSettings();
            const cacheKey = getFileCacheKey(current, settings);
            if (puzzleCache.has(cacheKey)) {
                lastData = puzzleCache.get(cacheKey);
                renderResult(lastData);
                setStatus(`Showing preview for ${current.name}`, "ok");
            }
        });
        fileList.appendChild(el);
    });
    generateBtn.disabled = false;
    document.getElementById("dlAllBtn").disabled = false;
}

function loadFiles(fileListValue) {
    const files = Array.from(fileListValue || []).filter((file) =>
        file.type.startsWith("image/"),
    );
    selectedFiles = files;
    currentFileIndex = 0;
    lastData = null;
    puzzleCache.clear();
    document.getElementById("resultArea").style.display = "none";
    document.getElementById("emptyState").style.display = "flex";
    updateFileThumb();
    renderFileList();
    if (files.length) {
        setStatus(
            `${files.length} image${files.length > 1 ? "s" : ""} ready. Generate a preview or export the batch PDF.`,
        );
    } else {
        setStatus("Upload one or more images to begin.");
    }
}

function updateTabView() {
    const previewWrap = document.getElementById("pagePreviewWrap");
    const legendWrap = document.getElementById("tab-legend-content");
    const fitInfo = document.getElementById("fitInfo");
    if (currentTab === "legend") {
        previewWrap.style.display = "none";
        legendWrap.style.display = "block";
        fitInfo.style.display = "none";
    } else {
        previewWrap.style.display = "flex";
        legendWrap.style.display = "none";
        fitInfo.style.display = "block";
        drawPreview();
    }
}

async function requestPuzzle(file, index) {
    const settings = getSettings();
    const cacheKey = getFileCacheKey(file, settings);
    if (puzzleCache.has(cacheKey)) {
        return puzzleCache.get(cacheKey);
    }

    const fd = new FormData();
    fd.append("photo", file);
    fd.append("cols", settings.cols);
    fd.append("nColors", settings.nColors);
    fd.append("pageW", settings.pageW);
    fd.append("pageH", settings.pageH);
    fd.append("margin", MARGIN_MM);
    fd.append("borderMm", settings.borderMm);

    const res = await fetch("/api/generate", {
        method: "POST",
        body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Server error");

    data.sourceName = file.name;
    data.pageLabel = defaultLabelForFile(file, index, selectedFiles.length);
    puzzleCache.set(cacheKey, data);
    return data;
}

function renderResult(data) {
    const legendGrid = document.getElementById("legendGrid");
    legendGrid.innerHTML = "";
    data.activePens.forEach((pen, i) => {
        const [rr, gg, bb] = pen.rgb;
        const lum = 0.299 * rr + 0.587 * gg + 0.114 * bb;
        const numColor = lum > 145 ? "#2a2a2a" : "#fff";
        const item = document.createElement("div");
        item.className = "legend-item";
        item.innerHTML = `
<div class="legend-swatch" style="background:${pen.hex}; color:${numColor}">${i + 1}</div>
<span class="legend-name">${pen.name}</span>`;
        legendGrid.appendChild(item);
    });

    document.getElementById("emptyState").style.display = "none";
    document.getElementById("resultArea").style.display = "block";
    const nextTab =
        currentTab === "blank" || currentTab === "answer" || currentTab === "legend"
            ? currentTab
            : "blank";
    document
        .querySelectorAll(".tab")
        .forEach((b) => b.classList.remove("active"));
    document.querySelector(`.tab[data-tab="${nextTab}"]`).classList.add("active");
    currentTab = nextTab;
    updateTabView();
}

function getRowsPerPage(data) {
    const topMarginExtra = data.pageLabel ? 4 : 0;
    return Math.max(
        1,
        Math.floor(
            (data.pageH - data.margin * 2 - topMarginExtra) / data.cellSizeMm,
        ),
    );
}

function drawPreview() {
    if (!lastData || (currentTab !== "blank" && currentTab !== "answer")) {
        return;
    }

    const { indexed, activePens, rows, cols, cellSizeMm, pageW, pageH, margin } =
        lastData;
    const rowsFit = getRowsPerPage(lastData);
    const canvas = document.getElementById("previewCanvas");
    const wrap = document.getElementById("pagePreviewWrap");
    const availW = Math.max(200, wrap.clientWidth - 40);
    const availH = Math.max(200, Math.min(720, window.innerHeight * 0.65));
    const scale = Math.min(availW / pageW, availH / pageH);

    canvas.width = Math.round(pageW * scale);
    canvas.height = Math.round(pageH * scale);

    const ctx = canvas.getContext("2d");
    const mx = margin * scale;
    const my = margin * scale;
    const cellPx = cellSizeMm * scale;
    const gridW = cols * cellPx;
    const gridH = rows * cellPx;
    const borderPx = Math.max(1, lastData.borderMm * scale);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (currentTab === "answer") {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const pidx = indexed[r * cols + c];
                ctx.fillStyle = activePens[pidx].hex;
                ctx.fillRect(mx + c * cellPx, my + r * cellPx, cellPx, cellPx);
            }
        }
    } else {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(mx, my, gridW, gridH);
    }

    ctx.strokeStyle =
        currentTab === "answer" ? "rgba(0,0,0,0.2)" : "rgba(150,140,130,0.9)";
    ctx.lineWidth = Math.max(0.35, scale * 0.09);
    ctx.beginPath();
    for (let r = 0; r <= rows; r++) {
        const y = my + r * cellPx;
        ctx.moveTo(mx, y);
        ctx.lineTo(mx + gridW, y);
    }
    for (let c = 0; c <= cols; c++) {
        const x = mx + c * cellPx;
        ctx.moveTo(x, my);
        ctx.lineTo(x, my + gridH);
    }
    ctx.stroke();

    if (currentTab === "blank" && cellPx >= 6) {
        const fontSize = Math.max(3, cellPx * 0.48);
        ctx.font = `${fontSize}px DM Mono, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(0,0,0,0.28)";
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const pidx = indexed[r * cols + c];
                ctx.fillText(
                    pidx + 1,
                    mx + c * cellPx + cellPx / 2,
                    my + r * cellPx + cellPx / 2,
                );
            }
        }
    }

    ctx.strokeStyle = "#000";
    ctx.lineWidth = borderPx;
    ctx.strokeRect(mx, my, gridW, gridH);

    if (rows > rowsFit) {
        const breakY = my + rowsFit * cellPx;
        ctx.save();
        ctx.strokeStyle = "rgba(200,60,30,0.9)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(mx, breakY);
        ctx.lineTo(mx + gridW, breakY);
        ctx.stroke();
        ctx.restore();
    }

    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(0.25, 0.25, canvas.width - 0.5, canvas.height - 0.5);

    const totalPages = Math.ceil(rows / rowsFit);
    document.getElementById("fitInfo").innerHTML =
        `Grid: <b>${cols} × ${rows}</b> &nbsp;·&nbsp; Cell: <b>${cellSizeMm.toFixed(1)} mm</b> &nbsp;·&nbsp; Border: <b>${lastData.borderMm.toFixed(1)} mm</b> &nbsp;·&nbsp; <span class="${totalPages === 1 ? "fit-ok" : "fit-warn"}">${totalPages === 1 ? "✓ Fits on 1 page" : `${totalPages} pages in PDF export`}</span>`;
}

function makeGridCanvas(data, mode, startRow, rowCount) {
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
        pdf.text(String(i + 1), lx + swatchSz / 2, ly + swatchSz - 0.5, {
            align: "center",
        });
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

function addGridPages(pdf, data, mode, isFirstPage) {
    const rowsPerPage = getRowsPerPage(data);
    const totalPages = Math.ceil(data.rows / rowsPerPage);
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
        if (!(isFirstPage && pageIndex === 0)) {
            pdf.addPage(
                [data.pageW, data.pageH],
                data.pageW >= data.pageH ? "landscape" : "portrait",
            );
        }

        const startRow = pageIndex * rowsPerPage;
        const rowCount = Math.min(rowsPerPage, data.rows - startRow);
        const topMarginExtra = data.pageLabel ? 4 : 0;
        const y = data.margin + topMarginExtra;
        const canvas = makeGridCanvas(data, mode, startRow, rowCount);
        const imgData = canvas.toDataURL("image/png");

        if (data.pageLabel) {
            const pageSuffix =
                totalPages > 1 ? ` (${pageIndex + 1}/${totalPages})` : "";
            pdf.setFontSize(9);
            pdf.setTextColor(40, 30, 20);
            pdf.text(
                `${data.pageLabel}${pageSuffix}`,
                data.pageW / 2,
                data.margin * 0.65,
                { align: "center" },
            );
        }

        pdf.addImage(
            imgData,
            "PNG",
            data.margin,
            y,
            data.cols * data.cellSizeMm,
            rowCount * data.cellSizeMm,
        );

        const usedBottom = y + rowCount * data.cellSizeMm;
        const legendRows = Math.ceil(
            data.activePens.length / Math.max(1, Math.floor(data.printableW / 34)),
        );
        const legendH = 10 + legendRows * 7;
        if (pageIndex === totalPages - 1) {
            const spaceBelow = data.pageH - usedBottom - data.margin;
            if (spaceBelow >= legendH + 2) {
                addLegend(pdf, data, usedBottom + 2);
            }
        }

        addFooter(pdf, data, mode === "blank" ? "Color by Number" : "Answer Key");
    }
}

function makeAnswerThumbnail(data) {
    return makeGridCanvas(data, "answer", 0, data.rows);
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
        reader.readAsDataURL(file);
    });
}

function loadImageMeta(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () =>
            resolve({
                width: img.naturalWidth || img.width,
                height: img.naturalHeight || img.height,
            });
        img.onerror = () => reject(new Error("Failed to load answer image"));
        img.src = dataUrl;
    });
}

async function makeAnswerSheetImage(puzzle, file, mode) {
    if (mode === "mosaic") {
        return {
            dataUrl: makeAnswerThumbnail(puzzle).toDataURL("image/png"),
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

async function addAnswerSheet(pdf, puzzles, files, isFirstPage, mode) {
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
        const aspect = imageData.aspect;
        const labelH = 7;
        const imgH = Math.min(cardW * aspect, 52);
        const cardH = labelH + imgH + 3;

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
        pdf.addImage(
            imageData.dataUrl,
            imageData.format,
            x,
            y + labelH,
            cardW,
            imgH,
        );
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.5);
        pdf.rect(x, y + labelH, cardW, imgH);

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

async function buildPdfForCurrent(opts) {
    if (!lastData) return;
    await document.fonts.ready;
    const { jsPDF } = window.jspdf;
    const orientation = lastData.pageW >= lastData.pageH ? "landscape" : "portrait";
    const pdf = new jsPDF({
        orientation,
        unit: "mm",
        format: [lastData.pageW, lastData.pageH],
    });

    let first = true;
    if (opts.blank) {
        addGridPages(pdf, lastData, "blank", first);
        first = false;
    }
    if (opts.answer) {
        addGridPages(pdf, lastData, "answer", first);
    }

    pdf.save(`${lastData.pageLabel || "puzzle"}.pdf`);
}

async function buildBatchPdf() {
    if (!selectedFiles.length) return;
    await document.fonts.ready;
    const { jsPDF } = window.jspdf;
    const puzzles = [];

    setStatus(`Generating ${selectedFiles.length} puzzle${selectedFiles.length > 1 ? "s" : ""}…`);
    document.getElementById("progressBar").style.width = "8%";

    for (let i = 0; i < selectedFiles.length; i++) {
        const puzzle = await requestPuzzle(selectedFiles[i], i);
        puzzles.push(puzzle);
        document.getElementById("progressBar").style.width =
            `${10 + ((i + 1) / selectedFiles.length) * 55}%`;
    }

    const firstPuzzle = puzzles[0];
    const orientation =
        firstPuzzle.pageW >= firstPuzzle.pageH ? "landscape" : "portrait";
    const pdf = new jsPDF({
        orientation,
        unit: "mm",
        format: [firstPuzzle.pageW, firstPuzzle.pageH],
    });

    let first = true;
    puzzles.forEach((puzzle, index) => {
        addGridPages(pdf, puzzle, "blank", first);
        first = false;
        document.getElementById("progressBar").style.width =
            `${68 + ((index + 1) / puzzles.length) * 20}%`;
    });

    await addAnswerSheet(
        pdf,
        puzzles,
        selectedFiles,
        first,
        answerSheetModeInput.value,
    );
    document.getElementById("progressBar").style.width = "100%";

    const base =
        document.getElementById("pageLabel").value.trim() || "color-by-number-batch";
    pdf.save(`${base}.pdf`);
}

fileInput.addEventListener("change", (e) => loadFiles(e.target.files));
dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("drag");
});
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag"));
dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("drag");
    loadFiles(e.dataTransfer.files);
});

document.getElementById("pageSizeSelect").addEventListener("change", () => {
    updateCellChip();
    if (lastData) drawPreview();
});

borderInput.addEventListener("input", () => {
    updateCellChip();
    if (lastData) {
        lastData.borderMm = Math.max(
            0,
            parseFloat(borderInput.value) || DEFAULT_BORDER_MM,
        );
        drawPreview();
    }
});

generateBtn.addEventListener("click", async () => {
    if (!selectedFiles.length) return;

    setBusy(true);
    animateProgress();
    setStatus("Sending preview image to server…");

    try {
        const data = await requestPuzzle(
            selectedFiles[currentFileIndex],
            currentFileIndex,
        );
        lastData = data;
        renderResult(data);
        setStatus(
            `Preview ready for ${data.sourceName} · ${data.cols}×${data.rows} grid · ${data.activePens.length} colors`,
            "ok",
        );
        document.getElementById("progressBar").style.width = "100%";
    } catch (err) {
        setStatus("Error: " + err.message, "err");
    } finally {
        setBusy(false);
    }
});

window.addEventListener("resize", () => {
    if (lastData) drawPreview();
});

document.getElementById("dlBlank").addEventListener("click", async () => {
    if (!lastData) return;
    document.getElementById("dlBlank").textContent = "…";
    try {
        await buildPdfForCurrent({ blank: true, answer: false });
    } finally {
        document.getElementById("dlBlank").textContent = "⬇ Puzzle PDF";
    }
});

document.getElementById("dlAnswer").addEventListener("click", async () => {
    if (!lastData) return;
    document.getElementById("dlAnswer").textContent = "…";
    try {
        await buildPdfForCurrent({ blank: false, answer: true });
    } finally {
        document.getElementById("dlAnswer").textContent = "⬇ Answer PDF";
    }
});

document.getElementById("dlFull").addEventListener("click", async () => {
    if (!selectedFiles.length) return;
    document.getElementById("dlFull").textContent = "…";
    setBusy(true);
    animateProgress();
    try {
        await buildBatchPdf();
        setStatus(
            `Batch PDF ready with ${selectedFiles.length} puzzle${selectedFiles.length > 1 ? "s" : ""} and an answer sheet.`,
            "ok",
        );
    } catch (err) {
        setStatus("Error: " + err.message, "err");
    } finally {
        setBusy(false);
        document.getElementById("dlFull").textContent = "⬇ Batch PDF";
    }
});

document.getElementById("dlAllBtn").addEventListener("click", () => {
    document.getElementById("dlFull").click();
});

updateCellChip();
