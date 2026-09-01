"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {FaceDetector, FaceLandmarker, FilesetResolver} from "@mediapipe/tasks-vision";
import {
    ACCEPTED_MIME_TYPES,
    CANVAS_HEIGHT,
    CANVAS_WIDTH,
    clampTransform,
    drawMosaic,
    expandRect,
    expandPolygon,
    formatExportFilename,
    getCoverTransform,
    MAX_SOURCE_PIXELS,
    MosaicRegion,
    MosaicEffect,
    MosaicShape,
    MosaicStrength,
    Rect,
    toCanvasRect,
    Transform,
    validateImageFile,
} from "@/lib/story-editor";

type Phase = "empty" | "loading" | "cropping" | "detecting" | "auto-mosaic" | "editing" | "exporting" | "error";
type DetectionResult = "detected" | "not-found" | "fallback" | "failed";
type PointerState = { id: number; point: { x: number; y: number } } | null;

const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
const LANDMARKER_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const FACE_OVAL_INDICES = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];

const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) => {
    const bounds = canvas.getBoundingClientRect();
    return {
        x: ((event.clientX - bounds.left) / bounds.width) * CANVAS_WIDTH,
        y: ((event.clientY - bounds.top) / bounds.height) * CANVAS_HEIGHT,
    };
};

const getSelectionRect = (start: { x: number; y: number }, point: { x: number; y: number }, shape: MosaicShape): Rect => {
    const width = Math.abs(point.x - start.x);
    const height = Math.abs(point.y - start.y);
    if (shape === "rectangle") {
        return {x: Math.min(start.x, point.x), y: Math.min(start.y, point.y), width, height};
    }
    const size = Math.min(width, height);
    return {
        x: point.x >= start.x ? start.x : start.x - size,
        y: point.y >= start.y ? start.y : start.y - size,
        width: size,
        height: size,
    };
};

export default function StoryEditor() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const detectorRef = useRef<FaceDetector | null>(null);
    const landmarkerRef = useRef<FaceLandmarker | null>(null);
    const pointerRef = useRef<PointerState>(null);
    const manualStartRef = useRef<{ x: number; y: number } | null>(null);
    const [phase, setPhase] = useState<Phase>("empty");
    const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [transform, setTransform] = useState<Transform | null>(null);
    const [regions, setRegions] = useState<MosaicRegion[]>([]);
    const [strength, setStrength] = useState<MosaicStrength>("strong");
    const [effect, setEffect] = useState<MosaicEffect>("gaussian");
    const [manualMode, setManualMode] = useState(false);
    const [manualShape, setManualShape] = useState<MosaicShape>("circle");
    const [outputFormat, setOutputFormat] = useState<"image/jpeg" | "image/png">("image/jpeg");
    const [sourceSize, setSourceSize] = useState<{ width: number; height: number } | null>(null);
    const [manualRect, setManualRect] = useState<Rect | null>(null);
    const [regionHistory, setRegionHistory] = useState<MosaicRegion[][]>([]);

    const draw = useCallback((includeOverlay = true) => {
        const canvas = canvasRef.current;
        const image = imageRef.current;
        if (!canvas || !image || !transform || !sourceSize) return;
        const context = canvas.getContext("2d");
        if (!context) return;

        context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        context.drawImage(image, transform.offset.x, transform.offset.y, sourceSize.width * transform.scale, sourceSize.height * transform.scale);

        const showMosaic = phase === "auto-mosaic" || phase === "editing" || phase === "exporting";
        if (showMosaic) regions.filter((region) => region.selected).forEach((region) => {
            const canvasRect = toCanvasRect(region.rect, transform);
            const clipped = {
                x: Math.max(0, Math.floor(canvasRect.x)),
                y: Math.max(0, Math.floor(canvasRect.y)),
                width: Math.min(CANVAS_WIDTH - Math.max(0, Math.floor(canvasRect.x)), Math.ceil(canvasRect.width)),
                height: Math.min(CANVAS_HEIGHT - Math.max(0, Math.floor(canvasRect.y)), Math.ceil(canvasRect.height)),
            };
            if (clipped.width > 0 && clipped.height > 0) {
                const clipPoints = region.points?.map((point) => ({
                    x: point.x * transform.scale + transform.offset.x,
                    y: point.y * transform.scale + transform.offset.y,
                }));
                drawMosaic(context, clipped, strength, effect, region.shape, clipPoints);
            }
        });

        if (includeOverlay && showMosaic) {
            regions.forEach((region) => {
                const rect = toCanvasRect(region.rect, transform);
                context.strokeStyle = region.selected ? "#f97316" : "#94a3b8";
                context.lineWidth = region.selected ? 5 : 3;
                context.setLineDash(region.source === "manual" ? [12, 8] : []);
                if (region.points && region.points.length >= 3) {
                    context.beginPath();
                    context.moveTo(
                        region.points[0].x * transform.scale + transform.offset.x,
                        region.points[0].y * transform.scale + transform.offset.y,
                    );
                    region.points.slice(1).forEach((point) => context.lineTo(
                        point.x * transform.scale + transform.offset.x,
                        point.y * transform.scale + transform.offset.y,
                    ));
                    context.closePath();
                    context.stroke();
                } else if (region.shape === "circle") {
                    context.beginPath();
                    context.ellipse(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width / 2, rect.height / 2, 0, 0, Math.PI * 2);
                    context.stroke();
                } else {
                    context.strokeRect(rect.x, rect.y, rect.width, rect.height);
                }
                context.setLineDash([]);
            });
            if (manualRect) {
                context.strokeStyle = "#fb923c";
                context.lineWidth = 4;
                context.setLineDash([10, 8]);
                if (manualShape === "circle") {
                    context.beginPath();
                    context.ellipse(manualRect.x + manualRect.width / 2, manualRect.y + manualRect.height / 2, manualRect.width / 2, manualRect.height / 2, 0, 0, Math.PI * 2);
                    context.stroke();
                } else {
                    context.strokeRect(manualRect.x, manualRect.y, manualRect.width, manualRect.height);
                }
                context.setLineDash([]);
            }
        }
    }, [effect, manualRect, manualShape, phase, regions, sourceSize, strength, transform]);

    useEffect(() => {
        draw();
    }, [draw]);

    const detectFaces = async (image: HTMLImageElement, width: number, height: number): Promise<DetectionResult> => {
        try {
            const vision = await FilesetResolver.forVisionTasks(WASM_URL);
            if (!landmarkerRef.current) {
                const options = {
                    baseOptions: {modelAssetPath: LANDMARKER_MODEL_URL},
                    runningMode: "IMAGE" as const,
                    numFaces: 10,
                    minFaceDetectionConfidence: 0.6,
                    minFacePresenceConfidence: 0.6,
                    minTrackingConfidence: 0.6,
                };
                try {
                    landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
                        ...options,
                        baseOptions: {...options.baseOptions, delegate: "GPU"},
                    });
                } catch (gpuError) {
                    console.warn("GPUでの顔輪郭検出初期化に失敗したため、CPUへフォールバックします:", gpuError);
                    landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, options);
                }
            }
            const result = landmarkerRef.current.detect(image);
            const detected = result.faceLandmarks.map((landmarks, index) => {
                const points = FACE_OVAL_INDICES
                    .map((landmarkIndex) => landmarks[landmarkIndex])
                    .filter((landmark): landmark is NonNullable<typeof landmark> => Boolean(landmark))
                    .map((landmark) => ({x: landmark.x * width, y: landmark.y * height}));
                if (points.length < 3) return null;
                const bounds = points.reduce((current, point) => ({
                    minX: Math.min(current.minX, point.x),
                    minY: Math.min(current.minY, point.y),
                    maxX: Math.max(current.maxX, point.x),
                    maxY: Math.max(current.maxY, point.y),
                }), {minX: width, minY: height, maxX: 0, maxY: 0});
                const rect = expandRect({
                    x: bounds.minX,
                    y: bounds.minY,
                    width: bounds.maxX - bounds.minX,
                    height: bounds.maxY - bounds.minY,
                }, 0.1, width, height);
                return {
                    id: `face-${index}`,
                    source: "face" as const,
                    rect,
                    points: expandPolygon(points, 0.1, width, height),
                    shape: "rectangle" as const,
                    selected: true,
                };
            }).filter((region): region is NonNullable<typeof region> => region !== null);
            setRegions(detected);
            return detected.length > 0 ? "detected" : "not-found";
        } catch (detectionError) {
            console.error("顔検出に失敗しました:", detectionError);
            try {
                if (!detectorRef.current) {
                    const vision = await FilesetResolver.forVisionTasks(WASM_URL);
                    const options = {
                        baseOptions: {modelAssetPath: MODEL_URL},
                        runningMode: "IMAGE" as const,
                        minDetectionConfidence: 0.6,
                    };
                    detectorRef.current = await FaceDetector.createFromOptions(vision, options);
                }
                const result = detectorRef.current.detect(image);
                setRegions(result.detections.map((detection, index) => {
                    const box = detection.boundingBox;
                    const rect = expandRect({
                        x: box?.originX ?? 0,
                        y: box?.originY ?? 0,
                        width: box?.width ?? 0,
                        height: box?.height ?? 0,
                    }, 0.1, width, height);
                    return {id: `face-${index}`, source: "face" as const, rect, shape: "rectangle" as const, selected: true};
                }));
                setError("顔の輪郭検出を利用できないため、矩形範囲でモザイクを適用しています。");
                return result.detections.length > 0 ? "fallback" : "not-found";
            } catch (fallbackError) {
                console.error("矩形の顔検出にも失敗しました:", fallbackError);
                setRegions([]);
                setError("顔検出を利用できません。手動でモザイク領域を追加できます。");
                return "failed";
            }
        }
    };

    const handleFile = async (file: File) => {
        setError(null);
        const validationError = validateImageFile(file);
        if (validationError) {
            setError(validationError);
            setPhase("error");
            return;
        }
        setPhase("loading");
        const url = URL.createObjectURL(file);
        try {
            const image = new Image();
            image.decoding = "async";
            image.src = url;
            await image.decode();
            if (image.naturalWidth * image.naturalHeight > MAX_SOURCE_PIXELS) {
                throw new Error("解像度が高すぎます。小さい画像を選択してください。");
            }
            imageRef.current = image;
            setSourceSize({width: image.naturalWidth, height: image.naturalHeight});
            setTransform(getCoverTransform(image.naturalWidth, image.naturalHeight));
            setDetectionResult(null);
            setRegionHistory([]);
            setPhase("cropping");
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "画像を読み込めませんでした。別の画像を選択してください。");
            setPhase("error");
        } finally {
            URL.revokeObjectURL(url);
        }
    };

    const confirmCrop = async () => {
        if (!imageRef.current || !sourceSize || phase !== "cropping") return;
        setError(null);
        setPhase("detecting");
        const result = await detectFaces(imageRef.current, sourceSize.width, sourceSize.height);
        setDetectionResult(result);
        setPhase("auto-mosaic");
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (phase !== "cropping" && phase !== "editing") return;
        event.currentTarget.setPointerCapture(event.pointerId);
        const point = getCanvasPoint(event, event.currentTarget);
        if (phase === "editing" && manualMode) {
            manualStartRef.current = point;
            setManualRect({x: point.x, y: point.y, width: 0, height: 0});
        } else if (phase === "cropping") {
            pointerRef.current = {id: event.pointerId, point};
        }
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const point = getCanvasPoint(event, event.currentTarget);
        if (phase === "editing" && manualMode && manualStartRef.current) {
            const start = manualStartRef.current;
            setManualRect(getSelectionRect(start, point, manualShape));
            return;
        }
        if (phase !== "cropping" || !pointerRef.current || pointerRef.current.id !== event.pointerId || !transform || !sourceSize) return;
        const dx = point.x - pointerRef.current.point.x;
        const dy = point.y - pointerRef.current.point.y;
        setTransform(clampTransform({
            ...transform,
            offset: {x: transform.offset.x + dx, y: transform.offset.y + dy}
        }, sourceSize.width, sourceSize.height));
        pointerRef.current.point = point;
    };

    const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (phase === "editing" && manualMode && manualStartRef.current && manualRect) {
            addManualRegion(manualRect);
            manualStartRef.current = null;
            setManualRect(null);
            return;
        }
        if (!pointerRef.current || pointerRef.current.id !== event.pointerId) return;
        pointerRef.current = null;
    };

    const addManualRegion = (rect: Rect) => {
        if (!sourceSize || !transform || rect.width < 20 || rect.height < 20) return;
        const sourceRect = {
            x: Math.max(0, (rect.x - transform.offset.x) / transform.scale),
            y: Math.max(0, (rect.y - transform.offset.y) / transform.scale),
            width: rect.width / transform.scale,
            height: rect.height / transform.scale,
        };
        setRegionHistory((history) => [...history, regions]);
        setRegions([...regions, {
            id: `manual-${Date.now()}`,
            source: "manual",
            rect: expandRect(sourceRect, 0.02, sourceSize.width, sourceSize.height),
            shape: manualShape,
            selected: true,
        }]);
    };

    const undoLastRegion = () => {
        setRegionHistory((history) => {
            const previousRegions = history.at(-1);
            if (!previousRegions) return history;
            setRegions(previousRegions);
            return history.slice(0, -1);
        });
    };

    const handleExport = () => {
        const canvas = canvasRef.current;
        if (!canvas || phase !== "editing") return;
        setPhase("exporting");
        draw(false);
        canvas.toBlob((blob) => {
            if (!blob) {
                setError("画像を保存できませんでした。もう一度お試しください。");
                setPhase("editing");
                return;
            }
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = formatExportFilename(outputFormat);
            link.click();
            URL.revokeObjectURL(url);
            setPhase("editing");
            draw();
        }, outputFormat, outputFormat === "image/jpeg" ? 0.92 : undefined);
    };

    const reset = () => {
        imageRef.current = null;
        setSourceSize(null);
        setTransform(null);
        setRegions([]);
        setDetectionResult(null);
        setRegionHistory([]);
        setError(null);
        setPhase("empty");
        if (inputRef.current) inputRef.current.value = "";
    };

    const toggleRegion = (id: string) => {
        setRegions((current) => current.map((region) => region.id === id ? {
            ...region,
            selected: !region.selected
        } : region));
    };

    const selectFile = () => inputRef.current?.click();
    const isBusy = phase === "loading" || phase === "detecting" || phase === "exporting";

    return (
        <main
            className="min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <div className="mx-auto max-w-5xl">
                <header className="mb-8">
                    <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-orange-500">Story Snap</p>
                    <h1 className="text-3xl font-bold sm:text-4xl">SNSストーリー画像加工</h1>
                    <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">画像を9:16に整え、顔や指定した範囲にモザイクをかけて保存できます。画像は端末内で処理されます。</p>
                </header>

                {phase === "empty" || phase === "error" ? (
                    <section
                        className="rounded-3xl border-2 border-dashed border-slate-300 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
                        <h2 className="text-xl font-semibold">画像を選択してください</h2>
                        <p className="mt-2 text-sm text-slate-500">JPEG、PNG、WebP / 10 MB以下</p>
                        <button type="button" onClick={selectFile}
                                className="mt-6 rounded-full bg-orange-500 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-orange-600">画像を選択
                        </button>
                        {error && <p role="alert"
                                     className="mx-auto mt-5 max-w-lg rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
                        <input ref={inputRef} className="hidden" type="file" accept={ACCEPTED_MIME_TYPES.join(",")}
                               onChange={(event) => {
                                   const file = event.target.files?.[0];
                                   if (file) void handleFile(file);
                               }}/>
                    </section>
                ) : phase === "detecting" ? (
                    <section className="rounded-2xl bg-white p-5 text-center shadow-sm dark:bg-slate-900">
                        <h2 className="font-semibold">Step 2: モザイク</h2>
                        <p role="status" className="mt-2 text-sm text-slate-500">顔を検出しています…</p>
                    </section>
                ) : (
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                        <section className="flex justify-center rounded-3xl bg-slate-900 p-4 shadow-xl sm:p-8">
                            <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT}
                                    aria-label="9:16画像編集領域。Step 1ではトリミング、Step 2ではモザイク範囲を指定します。"
                                    className="h-auto max-h-[72vh] w-full max-w-[405px] touch-none rounded-xl bg-white object-contain"
                                    onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
                                    onPointerUp={handlePointerUp}/>
                        </section>
                        <aside className="space-y-4">
                            {phase === "cropping" ? (
                                <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900">
                                    <h2 className="font-semibold">Step 1: トリミング</h2>
                                    <p className="mt-1 text-sm text-slate-500">画像をドラッグして9:16の構図を決めてください。確定後は変更できません。</p>
                                    <button type="button" onClick={() => void confirmCrop()} disabled={isBusy}
                                            className="mt-4 w-full rounded-lg bg-orange-500 px-4 py-3 font-semibold text-white">トリミングを確定
                                    </button>
                                </section>
                            ) : phase === "auto-mosaic" ? (
                                <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900">
                                   <h2 className="font-semibold">Step 2: 顔検出＆自動モザイク</h2>
                                   <p role="status" className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                                       {detectionResult === "detected" && "顔を検出し、自動モザイクを適用しました。"}
                                       {detectionResult === "not-found" && "顔は検出されませんでした。"}
                                       {detectionResult === "fallback" && "顔を検出し、自動モザイクを適用しました（矩形範囲）。"}
                                       {detectionResult === "failed" && "顔検出に失敗しました。"}
                                   </p>
                                   <button type="button" onClick={() => setPhase("editing")}
                                           className="mt-4 w-full rounded-lg bg-orange-500 px-4 py-3 font-semibold text-white">Step 3へ進む
                                   </button>
                                </section>
                            ) : (
                                <>
                            <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900">
                                <h2 className="font-semibold">Step 3: 手動調整</h2>
                                <p className="mt-1 text-sm text-slate-500">選択中の範囲にモザイクが適用されます。</p>
                                <div className="mt-4 space-y-2">
                                    {regions.map((region, index) => <label key={region.id}
                                                                           className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700"><input
                                        type="checkbox" checked={region.selected}
                                        onChange={() => toggleRegion(region.id)}/>{region.source === "face" ? `顔 ${index + 1}` : "手動領域"}
                                    </label>)}
                                    {regions.length === 0 &&
                                        <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">顔を検出できませんでした。</p>}
                                </div>
                                <button type="button" onClick={() => setManualMode((current) => !current)}
                                        className={`mt-4 w-full rounded-lg border px-4 py-2 text-sm font-semibold ${manualMode ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-300 dark:border-slate-600"}`}>{manualMode ? "手動追加を終了" : "手動で範囲を追加"}</button>
                                <button type="button" onClick={undoLastRegion} disabled={regionHistory.length === 0}
                                        className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600">モザイクを一つ戻す</button>
                                {manualMode &&
                                   <>
                                       <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="手動選択の形状">
                                           {(["circle", "rectangle"] as const).map((shape) => <button
                                               key={shape}
                                               type="button"
                                               onClick={() => setManualShape(shape)}
                                               aria-pressed={manualShape === shape}
                                               className={`rounded-lg border px-3 py-2 text-sm ${manualShape === shape ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-300 dark:border-slate-600"}`}
                                           >{shape === "circle" ? "円形" : "四角形"}</button>)}
                                       </div>
                                       <p className="mt-2 text-xs text-slate-500">Canvas上で選択範囲をドラッグして追加してください。</p>
                                   </>}
                            </section>
                            <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900">
                               <h2 className="font-semibold">加工方法</h2>
                               <div className="mt-3 grid grid-cols-2 gap-2">
                                   {(["gaussian", "pixelate"] as const).map((value) => <button key={value}
                                                                                                 type="button"
                                                                                                 onClick={() => setEffect(value)}
                                                                                                 className={`rounded-lg border px-2 py-2 text-sm ${effect === value ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-300 dark:border-slate-600"}`}>{value === "gaussian" ? "ガウシアンぼかし" : "ブロックモザイク"}</button>)}
                               </div>
                               <h2 className="mt-4 font-semibold">加工強度</h2>
                                <div className="mt-3 grid grid-cols-3 gap-2">
                                    {(["weak", "medium", "strong"] as const).map((value) => <button key={value}
                                                                                                    type="button"
                                                                                                    onClick={() => setStrength(value)}
                                                                                                    className={`rounded-lg border px-2 py-2 text-sm ${strength === value ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-300 dark:border-slate-600"}`}>{value === "weak" ? "弱" : value === "medium" ? "中" : "強"}</button>)}
                                </div>
                                <label className="mt-4 block text-sm font-medium">保存形式<select value={outputFormat}
                                                                                                  onChange={(event) => setOutputFormat(event.target.value as "image/jpeg" | "image/png")}
                                                                                                  className="mt-2 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-600">
                                    <option value="image/jpeg">JPEG</option>
                                    <option value="image/png">PNG</option>
                                </select></label>
                            </section>
                                </>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                                <button type="button" onClick={reset} disabled={isBusy}
                                        className="rounded-lg border border-slate-300 px-4 py-3 font-semibold disabled:opacity-50 dark:border-slate-600">リセット
                                </button>
                                <button type="button" onClick={() => void handleExport()} disabled={isBusy || phase !== "editing"}
                                        className="rounded-lg bg-orange-500 px-4 py-3 font-semibold text-white disabled:opacity-50">{phase === "exporting" ? "保存中…" : "保存"}</button>
                            </div>
                            {phase === "loading" && <p role="status"
                                                       className="text-center text-sm text-slate-500">画像を読み込んでいます…</p>}
                            {phase === "cropping" && <p role="status"
                                                        className="text-center text-sm text-slate-500">画像をドラッグしてトリミング範囲を決めてください。</p>}
                            {error && <p role="alert"
                                         className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{error}</p>}
                        </aside>
                    </div>
                )}
            </div>
        </main>
    );
}
