import {
    CANVAS_HEIGHT,
    CANVAS_WIDTH,
    clampTransform,
    expandRect,
    expandPolygon,
    formatExportFilename,
    getGaussianBlurRadius,
    getCoverTransform,
    getMosaicBlockSize,
    translateMosaicRegion,
    toCanvasRect,
    validateImageFile,
} from "@/lib/story-editor";

describe("story editor utilities", () => {
    it("validates supported file types and size", () => {
        expect(validateImageFile(new File(["image"], "photo.jpg", {type: "image/jpeg"}))).toBeNull();
        expect(validateImageFile(new File(["image"], "photo.gif", {type: "image/gif"}))).toContain("JPEG");
        const oversized = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.png", {type: "image/png"});
        expect(validateImageFile(oversized)).toContain("10 MB");
    });

    it("creates a centered cover transform and clamps movement", () => {
        const transform = getCoverTransform(1920, 1080);
        expect(transform.scale).toBe(CANVAS_HEIGHT / 1080);
        expect(transform.offset.y).toBe(0);
        const clamped = clampTransform({...transform, offset: {x: 1000, y: 1000}}, 1920, 1080);
        expect(clamped.offset.x).toBeLessThanOrEqual(0);
        expect(clamped.offset.y).toBeLessThanOrEqual(0);
    });

    it("converts and expands mosaic regions", () => {
        const rect = expandRect({x: 100, y: 200, width: 100, height: 80}, 0.1, 500, 500);
        expect(rect).toEqual({x: 90, y: 192, width: 120, height: 96});
        expect(toCanvasRect(rect, {scale: 2, offset: {x: 10, y: 20}})).toEqual({
            x: 190,
            y: 404,
            width: 240,
            height: 192,
        });
    });

    it("expands face polygons while keeping points inside the source image", () => {
        expect(expandPolygon([
            {x: 20, y: 20},
            {x: 80, y: 20},
            {x: 50, y: 80},
        ], 0.1, 100, 100)).toEqual([
            {x: 14, y: 14},
            {x: 86, y: 14},
            {x: 50, y: 86},
        ]);
    });

    it("moves mosaic regions and their face points within the source image", () => {
        const region = translateMosaicRegion({
            id: "face-1",
            source: "face",
            rect: {x: 80, y: 100, width: 40, height: 50},
            shape: "rectangle",
            points: [{x: 85, y: 105}, {x: 110, y: 140}],
            selected: true,
        }, {x: 30, y: -20}, 200, 200);
        expect(region.rect).toEqual({x: 110, y: 80, width: 40, height: 50});
        expect(region.points).toEqual([{x: 115, y: 85}, {x: 140, y: 120}]);

        const clamped = translateMosaicRegion(region, {x: 100, y: 200}, 200, 200);
        expect(clamped.rect).toEqual({x: 160, y: 150, width: 40, height: 50});
        expect(clamped.points).toEqual([{x: 165, y: 155}, {x: 190, y: 190}]);
    });

    it("maps mosaic strengths to pixelation and Gaussian blur settings", () => {
        expect(getMosaicBlockSize("weak")).toBe(12);
        expect(getMosaicBlockSize("medium")).toBe(24);
        expect(getMosaicBlockSize("strong")).toBe(40);
        expect(getGaussianBlurRadius("weak")).toBe(6);
        expect(getGaussianBlurRadius("medium")).toBe(12);
        expect(getGaussianBlurRadius("strong")).toBe(18);
        expect(formatExportFilename("image/png", new Date(2026, 8, 1, 21, 33, 58))).toBe("story-snap-20260901-213358.png");
        expect(CANVAS_WIDTH / CANVAS_HEIGHT).toBe(9 / 16);
    });
});
