export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 1920;
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_SOURCE_PIXELS = 40_000_000;
export const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };
export type Transform = { scale: number; offset: Point };
export type MosaicStrength = "weak" | "medium" | "strong";
export type MosaicEffect = "gaussian" | "pixelate";
export type MosaicShape = "rectangle" | "circle";
export type MosaicRegion = {
    id: string;
    source: "face" | "manual";
    rect: Rect;
    shape: MosaicShape;
    points?: Point[];
    selected: boolean;
};

export function validateImageFile(file: File): string | null {
    if (!ACCEPTED_MIME_TYPES.includes(file.type as (typeof ACCEPTED_MIME_TYPES)[number])) {
        return "JPEG、PNG、WebPの画像を選択してください。";
    }
    if (file.size > MAX_FILE_SIZE) {
        return "画像は10 MB以下にしてください。";
    }
    return null;
}

export function getCoverTransform(width: number, height: number): Transform {
    const scale = Math.max(CANVAS_WIDTH / width, CANVAS_HEIGHT / height);
    return {
        scale,
        offset: {
            x: (CANVAS_WIDTH - width * scale) / 2,
            y: (CANVAS_HEIGHT - height * scale) / 2,
        },
    };
}

export function clampTransform(
    transform: Transform,
    sourceWidth: number,
    sourceHeight: number,
): Transform {
    const scaledWidth = sourceWidth * transform.scale;
    const scaledHeight = sourceHeight * transform.scale;
    const minX = CANVAS_WIDTH - scaledWidth;
    const minY = CANVAS_HEIGHT - scaledHeight;

    return {
        scale: transform.scale,
        offset: {
            x: Math.min(0, Math.max(minX, transform.offset.x)),
            y: Math.min(0, Math.max(minY, transform.offset.y)),
        },
    };
}

export function toCanvasRect(rect: Rect, transform: Transform): Rect {
    return {
        x: rect.x * transform.scale + transform.offset.x,
        y: rect.y * transform.scale + transform.offset.y,
        width: rect.width * transform.scale,
        height: rect.height * transform.scale,
    };
}

export function expandRect(rect: Rect, ratio = 0.1, maxWidth?: number, maxHeight?: number): Rect {
    const x = rect.x - rect.width * ratio;
    const y = rect.y - rect.height * ratio;
    const width = rect.width * (1 + ratio * 2);
    const height = rect.height * (1 + ratio * 2);

    return {
        x: Math.max(0, x),
        y: Math.max(0, y),
        width: Math.min(width, (maxWidth ?? Number.POSITIVE_INFINITY) - Math.max(0, x)),
        height: Math.min(height, (maxHeight ?? Number.POSITIVE_INFINITY) - Math.max(0, y)),
    };
}

export function expandPolygon(points: Point[], ratio = 0.1, maxWidth?: number, maxHeight?: number): Point[] {
    if (points.length < 3) return points;
    const bounds = points.reduce((current, point) => ({
        minX: Math.min(current.minX, point.x),
        minY: Math.min(current.minY, point.y),
        maxX: Math.max(current.maxX, point.x),
        maxY: Math.max(current.maxY, point.y),
    }), {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
    });
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const scale = 1 + ratio * 2;

    return points.map((point) => ({
        x: Math.max(0, Math.min(maxWidth ?? Number.POSITIVE_INFINITY, centerX + (point.x - centerX) * scale)),
        y: Math.max(0, Math.min(maxHeight ?? Number.POSITIVE_INFINITY, centerY + (point.y - centerY) * scale)),
    }));
}

export function getMosaicBlockSize(strength: MosaicStrength): number {
    return strength === "weak" ? 12 : strength === "strong" ? 40 : 24;
}

export function getGaussianBlurRadius(strength: MosaicStrength): number {
    return strength === "weak" ? 6 : strength === "strong" ? 18 : 12;
}

export function drawMosaic(
    context: CanvasRenderingContext2D,
    rect: Rect,
    strength: MosaicStrength,
    effect: MosaicEffect = "gaussian",
    shape: MosaicShape = "rectangle",
    clipPoints?: Point[],
): void {
    context.save();
    context.beginPath();
    if (clipPoints && clipPoints.length >= 3) {
        context.moveTo(clipPoints[0].x, clipPoints[0].y);
        clipPoints.slice(1).forEach((point) => context.lineTo(point.x, point.y));
        context.closePath();
    } else if (shape === "circle") {
        context.ellipse(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2,
            rect.width / 2,
            rect.height / 2,
            0,
            0,
            Math.PI * 2,
        );
    } else {
        context.rect(rect.x, rect.y, rect.width, rect.height);
    }
    context.clip();

    if (effect === "gaussian") {
        drawGaussianBlur(context, rect, strength);
        context.restore();
        return;
    }

    const blockSize = getMosaicBlockSize(strength);
    const imageData = context.getImageData(rect.x, rect.y, rect.width, rect.height);
    const data = imageData.data;

    for (let y = 0; y < rect.height; y += blockSize) {
        for (let x = 0; x < rect.width; x += blockSize) {
            const sampleX = Math.min(x + Math.floor(blockSize / 2), rect.width - 1);
            const sampleY = Math.min(y + Math.floor(blockSize / 2), rect.height - 1);
            const sampleIndex = (sampleY * rect.width + sampleX) * 4;

            context.fillStyle = `rgb(${data[sampleIndex]}, ${data[sampleIndex + 1]}, ${data[sampleIndex + 2]})`;
            context.fillRect(x + rect.x, y + rect.y, blockSize, blockSize);
        }
    }
    context.restore();
}

export function drawGaussianBlur(
    context: CanvasRenderingContext2D,
    rect: Rect,
    strength: MosaicStrength,
): void {
    const imageData = context.getImageData(rect.x, rect.y, rect.width, rect.height);
    const blurredCanvas = document.createElement("canvas");
    blurredCanvas.width = rect.width;
    blurredCanvas.height = rect.height;
    const blurredContext = blurredCanvas.getContext("2d");
    if (!blurredContext) return;

    blurredContext.putImageData(imageData, 0, 0);
    context.filter = `blur(${getGaussianBlurRadius(strength)}px)`;
    context.drawImage(blurredCanvas, rect.x, rect.y);
}

export function formatExportFilename(format: "image/jpeg" | "image/png", date = new Date()): string {
    const pad = (value: number) => String(value).padStart(2, "0");
    const timestamp = [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
    ].join("") + "-" + [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join("");
    return `story-snap-${timestamp}.${format === "image/png" ? "png" : "jpg"}`;
}
