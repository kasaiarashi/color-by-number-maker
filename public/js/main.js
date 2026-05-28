import { requestPuzzle } from "./api.js";
import { dom, syncGeneratorModeUi } from "./dom.js";
import {
    animateProgress,
    applyCurrentSettingsToPreview,
    drawPreview,
    initPalette,
    loadFiles,
    renderResult,
    setBusy,
    setStatus,
    updateCellChip,
    updateTabView,
} from "./render.js";
import { buildBatchPdf, buildPdfForCurrent } from "./pdf.js";
import { state } from "./state.js";

initPalette();
syncGeneratorModeUi();
updateCellChip();

[
    [dom.colsSlider, dom.colsVal],
    [dom.colorsSlider, dom.colorsVal],
].forEach(([slider, output]) => {
    slider.addEventListener("input", () => {
        output.textContent = slider.value;
        updateCellChip();
    });
});

dom.tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
        dom.tabs.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.currentTab = btn.dataset.tab;
        updateTabView();
    });
});

dom.fileInput.addEventListener("change", (e) => loadFiles(e.target.files));
dom.dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dom.dropzone.classList.add("drag");
});
dom.dropzone.addEventListener("dragleave", () => dom.dropzone.classList.remove("drag"));
dom.dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dom.dropzone.classList.remove("drag");
    loadFiles(e.dataTransfer.files);
});

dom.pageSizeSelect.addEventListener("change", () => {
    updateCellChip();
    drawPreview();
});

dom.borderInput.addEventListener("input", applyCurrentSettingsToPreview);
dom.generatorModeInput.addEventListener("change", () => {
    syncGeneratorModeUi();
    updateCellChip();
    if (state.lastData) {
        setStatus("Generator style changed. Generate preview again to refresh the page.", "");
    }
});

dom.generateBtn.addEventListener("click", async () => {
    if (!state.selectedFiles.length) return;

    setBusy(true);
    animateProgress();
    setStatus("Sending preview image to server…");

    try {
        const data = await requestPuzzle(
            state.selectedFiles[state.currentFileIndex],
            state.currentFileIndex,
            dom.pageLabel.value,
        );
        state.lastData = data;
        renderResult(data);
        setStatus(
            `Preview ready for ${data.sourceName} · ${data.generatorMode} · ${data.cols}×${data.rows}`,
            "ok",
        );
        dom.progressBar.style.width = "100%";
    } catch (err) {
        setStatus("Error: " + err.message, "err");
    } finally {
        setBusy(false);
    }
});

window.addEventListener("resize", () => {
    drawPreview();
});

dom.dlBlank.addEventListener("click", async () => {
    if (!state.lastData) return;
    dom.dlBlank.textContent = "…";
    try {
        await buildPdfForCurrent({ blank: true, answer: false });
    } finally {
        dom.dlBlank.textContent = "⬇ Puzzle PDF";
    }
});

dom.dlAnswer.addEventListener("click", async () => {
    if (!state.lastData) return;
    dom.dlAnswer.textContent = "…";
    try {
        await buildPdfForCurrent({ blank: false, answer: true });
    } finally {
        dom.dlAnswer.textContent = "⬇ Answer PDF";
    }
});

dom.dlFull.addEventListener("click", async () => {
    if (!state.selectedFiles.length) return;
    dom.dlFull.textContent = "…";
    setBusy(true);
    animateProgress();
    try {
        await buildBatchPdf(requestPuzzle);
        setStatus(
            `Batch PDF ready with ${state.selectedFiles.length} puzzle${state.selectedFiles.length > 1 ? "s" : ""} and an answer sheet.`,
            "ok",
        );
    } catch (err) {
        setStatus("Error: " + err.message, "err");
    } finally {
        setBusy(false);
        dom.dlFull.textContent = "⬇ Batch PDF";
    }
});

dom.dlAllBtn.addEventListener("click", () => {
    dom.dlFull.click();
});
