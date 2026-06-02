export type Edge = "left" | "right" | "top" | "bottom";

export type EdgeStampMode = "none" | "all" | "odd" | "even" | "custom";

export type NormalStampMode = "none" | "first" | "last" | "all" | "custom";

export type PageSelectionMode = EdgeStampMode | "first" | "last";

export interface EdgeStampSettings {
  mode: EdgeStampMode;
  edge: Edge;
  widthMm: number;
  offsetPercent: number;
  maxSplitCount: number;
  opacity: number;
  customPagesText: string;
}

export interface NormalStampSettings {
  mode: NormalStampMode;
  xPercent: number;
  yPercent: number;
  customPagesText: string;
  randomOffsetPercent: number;
  randomRotateDegrees: number;
}

export interface AppSettings {
  edgeStamp: EdgeStampSettings;
  normalStamp: NormalStampSettings;
}

export interface LoadedPdfFile {
  id: string;
  file: File;
  bytes: Uint8Array;
  pageCount: number;
}

export interface LoadedSealImage {
  file: File;
  bytes: Uint8Array;
  dataUrl: string;
  mimeType: "image/png" | "image/jpeg";
  width: number;
  height: number;
}

export interface DisplayPageSize {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PreviewStamp {
  kind: "edge" | "normal";
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  rotationDegrees: number;
  imageUrl: string;
  dragOffsetXPercent?: number;
  dragOffsetYPercent?: number;
}

export interface PageStampPreview {
  pageWidth: number;
  pageHeight: number;
  stamps: PreviewStamp[];
}
