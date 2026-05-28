import { MARGIN_MM } from "./constants.js";
import { getSettings } from "./dom.js";
import { state } from "./state.js";

export function getFileCacheKey(file) {
    const settings = getSettings();
    return JSON.stringify({
        n: file.name,
        s: file.size,
        m: file.lastModified,
        c: settings.cols,
        k: settings.nColors,
        p: settings.pageW,
        q: settings.pageH,
        b: settings.borderMm,
        g: settings.generatorMode,
    });
}

export function defaultLabelForFile(file, index, total, pageLabelValue) {
    const base = pageLabelValue.trim();
    if (base && total > 1) return `${base} ${index + 1}`;
    if (base) return base;
    return file.name.replace(/\.[^.]+$/, "");
}

export async function requestPuzzle(file, index, pageLabelValue) {
    const settings = getSettings();
    const cacheKey = getFileCacheKey(file);
    if (state.puzzleCache.has(cacheKey)) {
        return state.puzzleCache.get(cacheKey);
    }

    const fd = new FormData();
    fd.append("photo", file);
    fd.append("cols", settings.cols);
    fd.append("nColors", settings.nColors);
    fd.append("pageW", settings.pageW);
    fd.append("pageH", settings.pageH);
    fd.append("margin", MARGIN_MM);
    fd.append("borderMm", settings.borderMm);
    fd.append("generatorMode", settings.generatorMode);

    const res = await fetch("/api/generate", {
        method: "POST",
        body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Server error");

    data.sourceName = file.name;
    data.pageLabel = defaultLabelForFile(
        file,
        index,
        state.selectedFiles.length,
        pageLabelValue,
    );
    state.puzzleCache.set(cacheKey, data);
    return data;
}

export function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
        reader.readAsDataURL(file);
    });
}

export function loadImageMeta(dataUrl) {
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
