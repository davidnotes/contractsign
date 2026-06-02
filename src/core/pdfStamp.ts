import { degrees, PDFDocument, type PDFImage } from "pdf-lib";
import { splitImageToParts, uint8ArrayToDataUrl } from "./imageProcessor";
import { selectPages } from "./pageSelector";
import {
  getDisplayPageSize,
  getEdgeStampPosition,
  getNormalStampPosition,
  mapDisplayRectToPdfRect,
  mmToPt,
  normalizeRotation,
} from "./position";
import type {
  AppSettings,
  Edge,
  LoadedPdfFile,
  LoadedSealImage,
  PageStampPreview,
  PreviewStamp,
  Rect,
} from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function getPartIndex(selectedIndex: number, selectedCount: number, partCount: number): number {
  if (partCount <= 1 || selectedCount <= 1) {
    return 0;
  }
  return Math.min(
    Math.round((selectedIndex / (selectedCount - 1)) * (partCount - 1)),
    partCount - 1,
  );
}

function createSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number): number {
  let state = seed || 1;
  state = (1664525 * state + 1013904223) >>> 0;
  return state / 0xffffffff;
}

function buildNormalJitter(fileId: string, pageIndex: number, settings: AppSettings) {
  const { randomOffsetPercent, randomRotateDegrees } = settings.normalStamp;
  const seedBase = `${fileId}:${pageIndex}`;
  const offsetX = (seededRandom(createSeed(`${seedBase}:offsetX`)) * 2 - 1) * randomOffsetPercent;
  const offsetY = (seededRandom(createSeed(`${seedBase}:offsetY`)) * 2 - 1) * randomOffsetPercent;
  const rotationDegrees = (seededRandom(createSeed(`${seedBase}:rotation`)) * 2 - 1) * randomRotateDegrees;

  return {
    offsetX,
    offsetY,
    rotationDegrees,
  };
}

function getNormalStampPageIndexes(totalPages: number, settings: AppSettings): number[] {
  return selectPages(totalPages, settings.normalStamp.mode, settings.normalStamp.customPagesText);
}

function getEdgeStampPageIndexes(totalPages: number, settings: AppSettings): number[] {
  return selectPages(totalPages, settings.edgeStamp.mode, settings.edgeStamp.customPagesText);
}

function ensureEdgeStampAllowed(totalPages: number, settings: AppSettings): void {
  if (settings.edgeStamp.mode !== "none" && totalPages <= 1) {
    throw new Error("单页 PDF 不能加骑缝章");
  }
}

function getEdgePieceRect(
  imageWidthPt: number,
  imageHeightPt: number,
  partPixelWidth: number,
  partPixelHeight: number,
  sealPixelWidth: number,
  sealPixelHeight: number,
  edge: Edge,
): Pick<Rect, "width" | "height"> {
  if (edge === "left" || edge === "right") {
    return {
      width: imageWidthPt * (partPixelWidth / sealPixelWidth),
      height: imageHeightPt,
    };
  }

  return {
    width: imageWidthPt,
    height: imageHeightPt * (partPixelHeight / sealPixelHeight),
  };
}

async function getBitmapSize(bytes: Uint8Array): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(new Blob([toArrayBuffer(bytes)], { type: "image/png" }));
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

async function embedImage(doc: PDFDocument, bytes: Uint8Array, mimeType: string): Promise<PDFImage> {
  if (mimeType === "image/jpeg") {
    return doc.embedJpg(bytes);
  }
  return doc.embedPng(bytes);
}

async function buildEdgeAssets(
  seal: LoadedSealImage,
  selectedPages: number[],
  settings: AppSettings,
): Promise<{ bytes: Uint8Array[]; urls: string[] }> {
  if (selectedPages.length === 0) {
    return { bytes: [], urls: [] };
  }

  const partCount = Math.min(selectedPages.length, Math.max(1, Math.floor(settings.edgeStamp.maxSplitCount)));
  const parts = await splitImageToParts(seal.file, partCount, settings.edgeStamp.edge);
  const urls = await Promise.all(parts.map((part) => uint8ArrayToDataUrl(part)));
  return { bytes: parts, urls };
}

async function buildEdgeRect(
  pageWidth: number,
  pageHeight: number,
  seal: LoadedSealImage,
  settings: AppSettings,
  partBytes: Uint8Array,
): Promise<Rect> {
  const size = await getBitmapSize(partBytes);
  const fullWidth = mmToPt(settings.edgeStamp.widthMm);
  const fullHeight = fullWidth * (seal.height / seal.width);
  const rectSize = getEdgePieceRect(
    fullWidth,
    fullHeight,
    size.width,
    size.height,
    seal.width,
    seal.height,
    settings.edgeStamp.edge,
  );

  return getEdgeStampPosition(
    pageWidth,
    pageHeight,
    rectSize.width,
    rectSize.height,
    settings.edgeStamp.edge,
    settings.edgeStamp.offsetPercent,
  );
}

function createNormalPreviewStamp(
  fileId: string,
  pageIndex: number,
  pageWidth: number,
  pageHeight: number,
  seal: LoadedSealImage,
  settings: AppSettings,
): PreviewStamp {
  const sealWidth = mmToPt(settings.edgeStamp.widthMm);
  const sealHeight = sealWidth * (seal.height / seal.width);
  const jitter = buildNormalJitter(fileId, pageIndex, settings);

  const rect = getNormalStampPosition(
    pageWidth,
    pageHeight,
    sealWidth,
    sealHeight,
    clamp(settings.normalStamp.xPercent + jitter.offsetX, 0, 100),
    clamp(settings.normalStamp.yPercent + jitter.offsetY, 0, 100),
  );

  return {
    kind: "normal",
    ...rect,
    opacity: settings.edgeStamp.opacity,
    rotationDegrees: jitter.rotationDegrees,
    imageUrl: seal.dataUrl,
    dragOffsetXPercent: jitter.offsetX,
    dragOffsetYPercent: jitter.offsetY,
  };
}

async function createEdgePreviewStampsForPage(
  pageWidth: number,
  pageHeight: number,
  seal: LoadedSealImage,
  settings: AppSettings,
  partBytesList: Uint8Array[],
  partUrls: string[],
  selectedPages: number[],
  pageIndex: number,
): Promise<PreviewStamp[]> {
  const selectedIndex = selectedPages.indexOf(pageIndex);
  if (selectedIndex < 0 || partBytesList.length === 0) {
    return [];
  }

  const partIndex = getPartIndex(selectedIndex, selectedPages.length, partBytesList.length);
  const partBytes = partBytesList[partIndex];
  const partUrl = partUrls[partIndex];
  const rect = await buildEdgeRect(pageWidth, pageHeight, seal, settings, partBytes);

  return [
    {
      kind: "edge",
      ...rect,
      opacity: settings.edgeStamp.opacity,
      rotationDegrees: 0,
      imageUrl: partUrl,
    },
  ];
}

export async function buildPagePreview(
  file: LoadedPdfFile,
  pageIndex: number,
  pageWidth: number,
  pageHeight: number,
  seal: LoadedSealImage | null,
  settings: AppSettings,
): Promise<PageStampPreview> {
  if (!seal) {
    return {
      pageWidth,
      pageHeight,
      stamps: [],
    };
  }

  const stamps: PreviewStamp[] = [];
  const normalPages = getNormalStampPageIndexes(file.pageCount, settings);
  if (normalPages.includes(pageIndex)) {
    stamps.push(createNormalPreviewStamp(file.id, pageIndex, pageWidth, pageHeight, seal, settings));
  }

  ensureEdgeStampAllowed(file.pageCount, settings);
  const edgePages = getEdgeStampPageIndexes(file.pageCount, settings);
  if (edgePages.length > 0) {
    const edgeAssets = await buildEdgeAssets(seal, edgePages, settings);
    const edgeStamps = await createEdgePreviewStampsForPage(
      pageWidth,
      pageHeight,
      seal,
      settings,
      edgeAssets.bytes,
      edgeAssets.urls,
      edgePages,
      pageIndex,
    );
    stamps.push(...edgeStamps);
  }

  return {
    pageWidth,
    pageHeight,
    stamps,
  };
}

export async function stampPdf(
  file: LoadedPdfFile,
  seal: LoadedSealImage,
  settings: AppSettings,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(file.bytes);
  ensureEdgeStampAllowed(file.pageCount, settings);
  const edgePages = getEdgeStampPageIndexes(file.pageCount, settings);
  const normalPages = getNormalStampPageIndexes(file.pageCount, settings);

  const originalSeal = await embedImage(pdfDoc, seal.bytes, seal.mimeType);
  const edgeAssets = await buildEdgeAssets(seal, edgePages, settings);
  const embeddedEdgeImages = await Promise.all(edgeAssets.bytes.map((part) => pdfDoc.embedPng(part)));

  for (let pageIndex = 0; pageIndex < file.pageCount; pageIndex += 1) {
    const page = pdfDoc.getPage(pageIndex);
    const rotation = normalizeRotation(page.getRotation().angle);
    const { width: baseWidth, height: baseHeight } = page.getSize();
    const displaySize = getDisplayPageSize(baseWidth, baseHeight, rotation);

    if (normalPages.includes(pageIndex)) {
      const sealWidth = mmToPt(settings.edgeStamp.widthMm);
      const sealHeight = sealWidth * (seal.height / seal.width);
      const jitter = buildNormalJitter(file.id, pageIndex, settings);
      const displayRect = getNormalStampPosition(
        displaySize.width,
        displaySize.height,
        sealWidth,
        sealHeight,
        clamp(settings.normalStamp.xPercent + jitter.offsetX, 0, 100),
        clamp(settings.normalStamp.yPercent + jitter.offsetY, 0, 100),
      );
      const pdfRect = mapDisplayRectToPdfRect(baseWidth, baseHeight, rotation, displayRect);
      page.drawImage(originalSeal, {
        x: pdfRect.x,
        y: pdfRect.y,
        width: pdfRect.width,
        height: pdfRect.height,
        opacity: settings.edgeStamp.opacity,
        rotate: degrees(jitter.rotationDegrees),
      });
    }

    const selectedIndex = edgePages.indexOf(pageIndex);
    if (selectedIndex >= 0 && embeddedEdgeImages.length > 0) {
      const partIndex = getPartIndex(selectedIndex, edgePages.length, embeddedEdgeImages.length);
      const partImage = embeddedEdgeImages[partIndex];
      const partBytes = edgeAssets.bytes[partIndex];
      const displayRect = await buildEdgeRect(
        displaySize.width,
        displaySize.height,
        seal,
        settings,
        partBytes,
      );
      const pdfRect = mapDisplayRectToPdfRect(baseWidth, baseHeight, rotation, displayRect);
      page.drawImage(partImage, {
        x: pdfRect.x,
        y: pdfRect.y,
        width: pdfRect.width,
        height: pdfRect.height,
        opacity: settings.edgeStamp.opacity,
      });
    }
  }

  return pdfDoc.save();
}
