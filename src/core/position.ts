import type { DisplayPageSize, Edge, Rect } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function mmToPt(mm: number): number {
  return (mm * 72) / 25.4;
}

export function normalizeRotation(rotation: number): 0 | 90 | 180 | 270 {
  const normalized = ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;
  if (normalized === 90 || normalized === 180 || normalized === 270) {
    return normalized;
  }
  return 0;
}

export function getDisplayPageSize(
  pageWidth: number,
  pageHeight: number,
  rotation: number,
): DisplayPageSize {
  const normalized = normalizeRotation(rotation);
  if (normalized === 90 || normalized === 270) {
    return {
      width: pageHeight,
      height: pageWidth,
    };
  }
  return {
    width: pageWidth,
    height: pageHeight,
  };
}

export function getEdgeStampPosition(
  pageWidth: number,
  pageHeight: number,
  imageWidth: number,
  imageHeight: number,
  edge: Edge,
  offsetPercent: number,
): Rect {
  const offset = clamp(offsetPercent, 0, 100) / 100;

  if (edge === "left" || edge === "right") {
    const maxY = Math.max(pageHeight - imageHeight, 0);
    const y = maxY * offset;
    return {
      x: edge === "left" ? 0 : Math.max(pageWidth - imageWidth, 0),
      y,
      width: imageWidth,
      height: imageHeight,
    };
  }

  const maxX = Math.max(pageWidth - imageWidth, 0);
  const x = maxX * offset;
  return {
    x,
    y: edge === "bottom" ? 0 : Math.max(pageHeight - imageHeight, 0),
    width: imageWidth,
    height: imageHeight,
  };
}

export function getNormalStampPosition(
  pageWidth: number,
  pageHeight: number,
  imageWidth: number,
  imageHeight: number,
  xPercent: number,
  yPercent: number,
): Rect {
  const centerX = clamp(xPercent, 0, 100) / 100;
  const centerY = clamp(yPercent, 0, 100) / 100;
  const x = clamp(pageWidth * centerX - imageWidth / 2, 0, Math.max(pageWidth - imageWidth, 0));
  const y = clamp(pageHeight * centerY - imageHeight / 2, 0, Math.max(pageHeight - imageHeight, 0));

  return {
    x,
    y,
    width: imageWidth,
    height: imageHeight,
  };
}

export function mapDisplayRectToPdfRect(
  pageWidth: number,
  pageHeight: number,
  rotation: number,
  rect: Rect,
): Rect {
  const normalized = normalizeRotation(rotation);

  if (normalized === 90) {
    return {
      x: pageWidth - rect.y - rect.height,
      y: rect.x,
      width: rect.height,
      height: rect.width,
    };
  }

  if (normalized === 180) {
    return {
      x: pageWidth - rect.x - rect.width,
      y: pageHeight - rect.y - rect.height,
      width: rect.width,
      height: rect.height,
    };
  }

  if (normalized === 270) {
    return {
      x: rect.y,
      y: pageHeight - rect.x - rect.width,
      width: rect.height,
      height: rect.width,
    };
  }

  return rect;
}
