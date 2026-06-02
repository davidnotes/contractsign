import type { Edge, LoadedSealImage } from "./types";

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("加载图片失败"));
    image.src = url;
  });
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("无法导出印章切片"));
        return;
      }

      blob
        .arrayBuffer()
        .then((buffer) => resolve(new Uint8Array(buffer)))
        .catch(() => reject(new Error("无法读取印章切片数据")));
    }, "image/png");
  });
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

async function exportSlice(
  image: HTMLImageElement,
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
): Promise<Uint8Array> {
  const canvas = createCanvas(sourceWidth, sourceHeight);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("无法初始化图片处理画布");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return canvasToPngBytes(canvas);
}

export async function loadSealImage(file: File): Promise<LoadedSealImage> {
  const dataUrl = await readAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const arrayBuffer = await readAsArrayBuffer(file);
  const mimeType = file.type === "image/jpeg" || file.type === "image/jpg" ? "image/jpeg" : "image/png";

  return {
    file,
    bytes: new Uint8Array(arrayBuffer),
    dataUrl,
    mimeType,
    width: image.width,
    height: image.height,
  };
}

export async function uint8ArrayToDataUrl(bytes: Uint8Array): Promise<string> {
  return readAsDataUrl(new Blob([toArrayBuffer(bytes)], { type: "image/png" }));
}

export async function splitImageToParts(
  imageFile: File,
  count: number,
  edge: Edge,
): Promise<Uint8Array[]> {
  const safeCount = Math.max(1, Math.floor(count));
  const dataUrl = await readAsDataUrl(imageFile);
  const image = await loadImage(dataUrl);
  const parts: Uint8Array[] = [];

  if (edge === "left" || edge === "right") {
    const sliceWidth = image.width / safeCount;
    for (let index = 0; index < safeCount; index += 1) {
      const startX = Math.round(index * sliceWidth);
      const endX = Math.round((index + 1) * sliceWidth);
      parts.push(await exportSlice(image, startX, 0, Math.max(endX - startX, 1), image.height));
    }
    return parts;
  }

  const sliceHeight = image.height / safeCount;
  for (let index = 0; index < safeCount; index += 1) {
    const startY = Math.round(index * sliceHeight);
    const endY = Math.round((index + 1) * sliceHeight);
    parts.push(await exportSlice(image, 0, startY, image.width, Math.max(endY - startY, 1)));
  }

  return edge === "top" ? [...parts].reverse() : parts;
}
