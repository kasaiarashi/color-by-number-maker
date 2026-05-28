import { DEFAULT_BORDER_MM, MARGIN_MM, PEN_COLORS } from "./constants.js";
import { dom, getPageDims } from "./dom.js";
import { getFileCacheKey } from "./api.js";
import { state } from "./state.js";

export function initPalette() {
    PEN_COLORS.forEach((c, i) => {
        const d = document.createElement("div");
        d.className = "pdot";
        d.style.background = c.hex;
        d.innerHTML = `<span class="tip">${i + 1}. ${c.name}</span>`;
        dom.strip.appendChild(d);
    });
}

export function setStatus(msg, type = "") {
    dom.status.textContent = msg;
    dom.status.className = "status" + (type ? ` ${type}` : "");
}

export function animateProgress() {
    let w = 0;
    const iv = setInterval(() => {
        w = Math.min(w + Math.random() * 8, 88);
        dom.progressBar.style.width = `${w}%`;
        if (w >= 88) clearInterval(iv);
    }, 120);
}

export function setBusy(isBusy) {
    dom.generateBtn.disabled = isBusy || state.selectedFiles.length === 0;
    dom.dlAllBtn.disabled = isBusy || state.selectedFiles.length === 0;
    dom.btnText.style.display = isBusy ? "none" : "";
    dom.spinner.style.display = isBusy ? "block" : "none";
    dom.progressWrap.style.display = isBusy ? "block" : "none";
    if (!isBusy) {
        dom.progressBar.style.width = "0%";
    }
}

export function updateCellChip() {
    const ps = getPageDims();
    const cols = parseInt(dom.colsSlider.value, 10) || 35;
    const cellMm = (ps.w - 2 * MARGIN_MM) / cols;
    const borderMm = Math.max(0, parseFloat(dom.borderInput.value) || 0);
    const isSketch = dom.generatorModeInput.value === "sketch";
    dom.cellChip.textContent =
        `Cell: ${cellMm.toFixed(1)} mm · Border: ${borderMm.toFixed(1)} mm · ${isSketch ? "Sketch" : "Mosaic"} · ${ps.w}×${ps.h} mm page`;
}

export function updateFileThumb() {
    if (state.currentThumbUrl) {
        URL.revokeObjectURL(state.currentThumbUrl);
        state.currentThumbUrl = null;
    }
    const currentFile = state.selectedFiles[state.currentFileIndex];
    if (!currentFile) {
        dom.thumb.style.display = "none";
        dom.thumb.removeAttribute("src");
        return;
    }
    state.currentThumbUrl = URL.createObjectURL(currentFile);
    dom.thumb.src = state.currentThumbUrl;
    dom.thumb.style.display = "block";
}

export function renderFileList() {
    dom.fileList.innerHTML = "";
    if (state.selectedFiles.length === 0) {
        dom.fileMeta.textContent = "No images selected.";
        dom.generateBtn.disabled = true;
        dom.dlAllBtn.disabled = true;
        return;
    }

    dom.fileMeta.textContent = `${state.selectedFiles.length} image${state.selectedFiles.length > 1 ? "s" : ""} selected. Preview uses the current image. Batch PDF uses all of them.`;
    state.selectedFiles.forEach((file, index) => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "file-pill" + (index === state.currentFileIndex ? " active" : "");
        el.innerHTML = `<span>${index + 1}. ${file.name}</span><span>${(file.size / 1024 / 1024).toFixed(1)} MB</span>`;
        el.addEventListener("click", () => {
            state.currentFileIndex = index;
            updateFileThumb();
            renderFileList();
            const current = state.selectedFiles[state.currentFileIndex];
            const cacheKey = getFileCacheKey(current);
            if (state.puzzleCache.has(cacheKey)) {
                state.lastData = state.puzzleCache.get(cacheKey);
                renderResult(state.lastData);
                setStatus(`Showing preview for ${current.name}`, "ok");
            }
        });
        dom.fileList.appendChild(el);
    });
    dom.generateBtn.disabled = false;
    dom.dlAllBtn.disabled = false;
}

export function loadFiles(fileListValue) {
    const files = Array.from(fileListValue || []).filter((file) =>
        file.type.startsWith("image/"),
    );
    state.selectedFiles = files;
    state.currentFileIndex = 0;
    state.lastData = null;
    state.puzzleCache.clear();
    dom.resultArea.style.display = "none";
    dom.emptyState.style.display = "flex";
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

export function renderResult(data) {
    dom.legendGrid.innerHTML = "";
    if (data.generatorMode === "sketch") {
        const item = document.createElement("div");
        item.className = "legend-item";
        item.textContent = "Sketch mode does not use a color legend.";
        dom.legendGrid.appendChild(item);
    } else {
        data.activePens.forEach((pen, i) => {
            const [rr, gg, bb] = pen.rgb;
            const lum = 0.299 * rr + 0.587 * gg + 0.114 * bb;
            const numColor = lum > 145 ? "#2a2a2a" : "#fff";
            const item = document.createElement("div");
            item.className = "legend-item";
            item.innerHTML = `
<div class="legend-swatch" style="background:${pen.hex}; color:${numColor}">${i + 1}</div>
<span class="legend-name">${pen.name}</span>`;
            dom.legendGrid.appendChild(item);
        });
    }

    dom.emptyState.style.display = "none";
    dom.resultArea.style.display = "block";
    const nextTab =
        state.currentTab === "blank" ||
        state.currentTab === "answer" ||
        state.currentTab === "legend"
            ? state.currentTab
            : "blank";
    dom.tabs.forEach((b) => b.classList.remove("active"));
    document.querySelector(`.tab[data-tab="${nextTab}"]`).classList.add("active");
    state.currentTab = nextTab;
    updateTabView();
}

export function getRowsPerPage(data) {
    const topMarginExtra = data.pageLabel ? 4 : 0;
    return Math.max(
        1,
        Math.floor((data.pageH - data.margin * 2 - topMarginExtra) / data.cellSizeMm),
    );
}

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

export function drawPreview() {
    if (!state.lastData || (state.currentTab !== "blank" && state.currentTab !== "answer")) {
        return;
    }

    const data = state.lastData;
    const availW = Math.max(200, dom.pagePreviewWrap.clientWidth - 40);
    const availH = Math.max(200, Math.min(720, window.innerHeight * 0.65));
    const scale = Math.min(availW / data.pageW, availH / data.pageH);

    dom.previewCanvas.width = Math.round(data.pageW * scale);
    dom.previewCanvas.height = Math.round(data.pageH * scale);

    const ctx = dom.previewCanvas.getContext("2d");
    const mx = data.margin * scale;
    const my = data.margin * scale;
    const cellPx = data.cellSizeMm * scale;
    const gridW = data.cols * cellPx;
    const gridH = data.rows * cellPx;
    const borderPx = Math.max(1, data.borderMm * scale);

    ctx.clearRect(0, 0, dom.previewCanvas.width, dom.previewCanvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, dom.previewCanvas.width, dom.previewCanvas.height);

    if (data.renderMode === "image") {
        const placement = getImagePlacement(data);
        const image = new Image();
        image.onload = () => {
            ctx.drawImage(
                image,
                placement.x * scale,
                placement.y * scale,
                placement.width * scale,
                placement.height * scale,
            );
            ctx.strokeStyle = "#000";
            ctx.lineWidth = borderPx;
            ctx.strokeRect(
                placement.x * scale,
                placement.y * scale,
                placement.width * scale,
                placement.height * scale,
            );
        };
        image.src =
            state.currentTab === "answer"
                ? data.answerImageDataUrl
                : data.drawableImageDataUrl;
        dom.fitInfo.innerHTML =
            `Mode: <b>Sketch</b> &nbsp;·&nbsp; Drawable page plus colored reference &nbsp;·&nbsp; Border: <b>${data.borderMm.toFixed(1)} mm</b> &nbsp;·&nbsp; <span class="fit-ok">✓ Fits on 1 page</span>`;
        return;
    } else if (state.currentTab === "answer") {
        for (let r = 0; r < data.rows; r++) {
            for (let c = 0; c < data.cols; c++) {
                const pidx = data.indexed[r * data.cols + c];
                ctx.fillStyle = data.activePens[pidx].hex;
                ctx.fillRect(mx + c * cellPx, my + r * cellPx, cellPx, cellPx);
            }
        }
    } else {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(mx, my, gridW, gridH);
    }

    ctx.strokeStyle =
        state.currentTab === "answer" ? "rgba(0,0,0,0.2)" : "rgba(150,140,130,0.9)";
    ctx.lineWidth = Math.max(0.35, scale * 0.09);
    ctx.beginPath();
    for (let r = 0; r <= data.rows; r++) {
        const y = my + r * cellPx;
        ctx.moveTo(mx, y);
        ctx.lineTo(mx + gridW, y);
    }
    for (let c = 0; c <= data.cols; c++) {
        const x = mx + c * cellPx;
        ctx.moveTo(x, my);
        ctx.lineTo(x, my + gridH);
    }
    ctx.stroke();

    if (data.generatorMode === "mosaic" && state.currentTab === "blank" && cellPx >= 6) {
        const fontSize = Math.max(3, cellPx * 0.48);
        ctx.font = `${fontSize}px DM Mono, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(0,0,0,0.28)";
        for (let r = 0; r < data.rows; r++) {
            for (let c = 0; c < data.cols; c++) {
                const pidx = data.indexed[r * data.cols + c];
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

    const rowsFit = getRowsPerPage(data);
    if (data.rows > rowsFit) {
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
    ctx.strokeRect(0.25, 0.25, dom.previewCanvas.width - 0.5, dom.previewCanvas.height - 0.5);

    const totalPages = Math.ceil(data.rows / rowsFit);
    const modeLabel = data.generatorMode === "sketch" ? "Sketch" : "Mosaic";
    dom.fitInfo.innerHTML =
        `Mode: <b>${modeLabel}</b> &nbsp;·&nbsp; Grid: <b>${data.cols} × ${data.rows}</b> &nbsp;·&nbsp; Cell: <b>${data.cellSizeMm.toFixed(1)} mm</b> &nbsp;·&nbsp; Border: <b>${data.borderMm.toFixed(1)} mm</b> &nbsp;·&nbsp; <span class="${totalPages === 1 ? "fit-ok" : "fit-warn"}">${totalPages === 1 ? "✓ Fits on 1 page" : `${totalPages} pages in PDF export`}</span>`;
}

export function updateTabView() {
    if (state.currentTab === "legend") {
        dom.pagePreviewWrap.style.display = "none";
        dom.tabLegendContent.style.display = "block";
        dom.fitInfo.style.display = "none";
    } else {
        dom.pagePreviewWrap.style.display = "flex";
        dom.tabLegendContent.style.display = "none";
        dom.fitInfo.style.display = "block";
        drawPreview();
    }
}

export function applyCurrentSettingsToPreview() {
    updateCellChip();
    if (state.lastData) {
        state.lastData.borderMm = Math.max(
            0,
            parseFloat(dom.borderInput.value) || DEFAULT_BORDER_MM,
        );
        drawPreview();
    }
}
