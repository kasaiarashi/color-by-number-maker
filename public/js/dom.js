import { DEFAULT_BORDER_MM, PAGE_SIZES } from "./constants.js";

export const dom = {
    strip: document.getElementById("paletteStrip"),
    fileInput: document.getElementById("fileInput"),
    dropzone: document.getElementById("dropzone"),
    thumb: document.getElementById("thumb"),
    generateBtn: document.getElementById("generateBtn"),
    fileMeta: document.getElementById("fileMeta"),
    fileList: document.getElementById("fileList"),
    borderInput: document.getElementById("borderMm"),
    answerSheetModeInput: document.getElementById("answerSheetMode"),
    generatorModeInput: document.getElementById("generatorMode"),
    pageSizeSelect: document.getElementById("pageSizeSelect"),
    colsSlider: document.getElementById("colsSlider"),
    colorsSlider: document.getElementById("colorsSlider"),
    colorsVal: document.getElementById("colorsVal"),
    colsVal: document.getElementById("colsVal"),
    pageLabel: document.getElementById("pageLabel"),
    cellChip: document.getElementById("cellChip"),
    status: document.getElementById("status"),
    progressWrap: document.getElementById("progressWrap"),
    progressBar: document.getElementById("progressBar"),
    btnText: document.getElementById("btnText"),
    spinner: document.getElementById("spinner"),
    emptyState: document.getElementById("emptyState"),
    resultArea: document.getElementById("resultArea"),
    fitInfo: document.getElementById("fitInfo"),
    legendGrid: document.getElementById("legendGrid"),
    pagePreviewWrap: document.getElementById("pagePreviewWrap"),
    previewCanvas: document.getElementById("previewCanvas"),
    dlAllBtn: document.getElementById("dlAllBtn"),
    dlBlank: document.getElementById("dlBlank"),
    dlAnswer: document.getElementById("dlAnswer"),
    dlFull: document.getElementById("dlFull"),
    tabLegendContent: document.getElementById("tab-legend-content"),
    tabs: [...document.querySelectorAll(".tab")],
    colorsControl: document.getElementById("colorsSlider").closest(".ctrl"),
};

export function getPageDims() {
    const key = dom.pageSizeSelect.value;
    return PAGE_SIZES[key] || PAGE_SIZES.a4p;
}

export function getSettings() {
    const ps = getPageDims();
    return {
        cols: parseInt(dom.colsSlider.value, 10) || 35,
        nColors: parseInt(dom.colorsSlider.value, 10) || 16,
        borderMm: Math.max(0, parseFloat(dom.borderInput.value) || DEFAULT_BORDER_MM),
        pageW: ps.w,
        pageH: ps.h,
        generatorMode: dom.generatorModeInput.value === "sketch" ? "sketch" : "mosaic",
    };
}

export function syncGeneratorModeUi() {
    const isSketch = dom.generatorModeInput.value === "sketch";
    dom.colorsSlider.disabled = isSketch;
    dom.colorsControl.style.opacity = isSketch ? "0.5" : "1";
}
