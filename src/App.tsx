import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { ControlPanel } from "./components/ControlPanel";
import { PdfPreview } from "./components/PdfPreview";
import { loadSealImage } from "./core/imageProcessor";
import { stampPdf } from "./core/pdfStamp";
import { getDocument } from "./core/pdfjs";
import type { AppSettings, LoadedPdfFile, LoadedSealImage } from "./core/types";

const defaultSettings: AppSettings = {
  edgeStamp: {
    mode: "none",
    edge: "right",
    widthMm: 40,
    offsetPercent: 50,
    maxSplitCount: 8,
    opacity: 0.9,
    customPagesText: "",
  },
  normalStamp: {
    mode: "none",
    xPercent: 50,
    yPercent: 50,
    customPagesText: "",
    randomOffsetPercent: 2,
    randomRotateDegrees: 2,
  },
};

function replacePdfExtension(name: string): string {
  return name.replace(/\.pdf$/i, "") || name;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function readPdfFile(file: File, index: number): Promise<LoadedPdfFile> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = getDocument({ data: bytes.slice() });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;
  await pdf.destroy();

  return {
    id: `${file.name}-${file.lastModified}-${index}`,
    file,
    bytes,
    pageCount,
  };
}

export default function App() {
  const [pdfFiles, setPdfFiles] = useState<LoadedPdfFile[]>([]);
  const [seal, setSeal] = useState<LoadedSealImage | null>(null);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const activeFile = useMemo(
    () => pdfFiles.find((file) => file.id === activeFileId) ?? pdfFiles[0] ?? null,
    [activeFileId, pdfFiles],
  );

  useEffect(() => {
    if (!activeFile && pdfFiles.length === 0) {
      setCurrentPageIndex(0);
      return;
    }

    if (activeFile && currentPageIndex > activeFile.pageCount - 1) {
      setCurrentPageIndex(activeFile.pageCount - 1);
    }
  }, [activeFile, currentPageIndex, pdfFiles.length]);

  async function handlePdfSelect(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const nextFiles = await Promise.all(
        Array.from(fileList).map(async (file, index) => {
          if (!file.name.toLowerCase().endsWith(".pdf")) {
            throw new Error(`文件不是 PDF：${file.name}`);
          }
          return readPdfFile(file, index);
        }),
      );

      setPdfFiles(nextFiles);
      setActiveFileId(nextFiles[0]?.id ?? null);
      setCurrentPageIndex(0);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "读取 PDF 失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleSealSelect(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type) && !/\.(png|jpg|jpeg)$/i.test(file.name)) {
        throw new Error("请上传 PNG 或 JPG 格式的印章图片");
      }
      const nextSeal = await loadSealImage(file);
      setSeal(nextSeal);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "读取印章失败");
    } finally {
      setBusy(false);
    }
  }

  function updateEdgeSetting<K extends keyof AppSettings["edgeStamp"]>(
    key: K,
    value: AppSettings["edgeStamp"][K],
  ) {
    setSettings((current) => ({
      ...current,
      edgeStamp: {
        ...current.edgeStamp,
        [key]: value,
      },
    }));
  }

  function updateNormalSetting<K extends keyof AppSettings["normalStamp"]>(
    key: K,
    value: AppSettings["normalStamp"][K],
  ) {
    setSettings((current) => ({
      ...current,
      normalStamp: {
        ...current.normalStamp,
        [key]: value,
      },
    }));
  }

  async function handleExport() {
    if (pdfFiles.length === 0) {
      setError("未上传 PDF");
      return;
    }
    if (!seal) {
      setError("未上传印章");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      if (pdfFiles.length === 1) {
        const stamped = await stampPdf(pdfFiles[0], seal, settings);
        downloadBlob(
          new Blob([toArrayBuffer(stamped)], { type: "application/pdf" }),
          `${replacePdfExtension(pdfFiles[0].file.name)}-stamped.pdf`,
        );
        return;
      }

      const zip = new JSZip();
      for (const file of pdfFiles) {
        const stamped = await stampPdf(file, seal, settings);
        zip.file(`${replacePdfExtension(file.file.name)}-stamped.pdf`, stamped);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadBlob(zipBlob, "stamped-pdfs.zip");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "导出失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <PdfPreview
        file={activeFile}
        files={pdfFiles}
        currentPageIndex={currentPageIndex}
        seal={seal}
        settings={settings}
        onNormalPositionChange={(xPercent, yPercent) => {
          setSettings((current) => ({
            ...current,
            normalStamp: {
              ...current.normalStamp,
              xPercent,
              yPercent,
            },
          }));
        }}
        onSelectFile={(fileId) => {
          setActiveFileId(fileId);
          setCurrentPageIndex(0);
        }}
        onPageChange={setCurrentPageIndex}
      />

      <ControlPanel
        files={pdfFiles}
        seal={seal}
        settings={settings}
        busy={busy}
        error={error}
        onPdfSelect={handlePdfSelect}
        onSealSelect={handleSealSelect}
        onEdgeChange={updateEdgeSetting}
        onNormalChange={updateNormalSetting}
        onExport={handleExport}
      />
    </main>
  );
}
