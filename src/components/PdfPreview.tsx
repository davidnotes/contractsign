import { type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { buildPagePreview } from "../core/pdfStamp";
import { getDocument } from "../core/pdfjs";
import type { AppSettings, LoadedPdfFile, LoadedSealImage, PageStampPreview, PreviewStamp } from "../core/types";

const RENDER_SCALE = 1.4;
const MAX_DISPLAY_SCALE = 1.12;
const PREVIEW_DEBOUNCE_MS = 220;

interface DragState {
  pointerId: number;
  stampWidth: number;
  stampHeight: number;
  offsetX: number;
  offsetY: number;
  dragOffsetXPercent: number;
  dragOffsetYPercent: number;
  rotationDegrees: number;
  imageUrl: string;
  opacity: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundPercent(value: number): number {
  return Number(clamp(value, 0, 100).toFixed(2));
}

function findNormalStamp(stamps: PreviewStamp[]): PreviewStamp | null {
  return stamps.find((stamp) => stamp.kind === "normal") ?? null;
}

function getDisplayScale(
  stageWidth: number,
  stageHeight: number,
  pageWidth: number,
  pageHeight: number,
): number {
  if (stageWidth <= 0 || stageHeight <= 0 || pageWidth <= 0 || pageHeight <= 0) {
    return 1;
  }

  return Math.min(stageWidth / pageWidth, stageHeight / pageHeight, MAX_DISPLAY_SCALE);
}

interface PdfPreviewProps {
  file: LoadedPdfFile | null;
  files: LoadedPdfFile[];
  currentPageIndex: number;
  seal: LoadedSealImage | null;
  settings: AppSettings;
  onNormalPositionChange: (xPercent: number, yPercent: number) => void;
  onSelectFile: (fileId: string) => void;
  onPageChange: (nextPageIndex: number) => void;
}

export function PdfPreview({
  file,
  files,
  currentPageIndex,
  seal,
  settings,
  onNormalPositionChange,
  onSelectFile,
  onPageChange,
}: PdfPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [preview, setPreview] = useState<PageStampPreview | null>(null);
  const [pageSize, setPageSize] = useState<{ pageWidth: number; pageHeight: number } | null>(null);
  const [stageSize, setStageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [pageLoading, setPageLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragPreviewStamp, setDragPreviewStamp] = useState<PreviewStamp | null>(null);

  const activeLabel = useMemo(() => {
    if (!file) {
      return "未选择 PDF";
    }
    return `${file.file.name} · 第 ${currentPageIndex + 1} / ${file.pageCount} 页`;
  }, [file, currentPageIndex]);

  useEffect(() => {
    const element = stageRef.current;
    if (!element) {
      return;
    }

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setStageSize({
        width: Math.max(rect.width - 32, 0),
        height: Math.max(rect.height - 32, 0),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    window.addEventListener("resize", updateSize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  useEffect(() => {
    if (!file || !canvasRef.current) {
      setPreview(null);
      setPageSize(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const activeFile = file;
    const canvas = canvasRef.current;
    const loadingTask = getDocument({ data: activeFile.bytes.slice() });

    async function run() {
      setPageLoading(true);
      setError(null);

      try {
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(currentPageIndex + 1);
        const baseViewport = page.getViewport({ scale: 1 });
        const deviceScale = window.devicePixelRatio || 1;
        const renderViewport = page.getViewport({ scale: RENDER_SCALE * deviceScale });
        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("无法初始化预览画布");
        }

        canvas.width = Math.ceil(renderViewport.width);
        canvas.height = Math.ceil(renderViewport.height);

        context.clearRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport: renderViewport }).promise;

        if (!cancelled) {
          setPageSize({
            pageWidth: baseViewport.width,
            pageHeight: baseViewport.height,
          });
          setDragState(null);
          setDragPreviewStamp(null);
        }

        await pdf.destroy();
      } catch (renderError) {
        if (!cancelled) {
          const message = renderError instanceof Error ? renderError.message : "预览渲染失败";
          setPreview(null);
          setPageSize(null);
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
      void loadingTask.destroy();
    };
  }, [file, currentPageIndex]);

  useEffect(() => {
    if (!file || !pageSize || dragState) {
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    const timeoutId = window.setTimeout(() => {
      void buildPagePreview(
        file,
        currentPageIndex,
        pageSize.pageWidth,
        pageSize.pageHeight,
        seal,
        settings,
      )
        .then((nextPreview) => {
          if (!cancelled) {
            setPreview(nextPreview);
            setError(null);
          }
        })
        .catch((previewError) => {
          if (!cancelled) {
            const message = previewError instanceof Error ? previewError.message : "预览渲染失败";
            setPreview(null);
            setError(message);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setPreviewLoading(false);
          }
        });
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      setPreviewLoading(false);
    };
  }, [currentPageIndex, dragState, file, pageSize, seal, settings]);

  const basePageSize = preview
    ? { pageWidth: preview.pageWidth, pageHeight: preview.pageHeight }
    : pageSize;
  const displayScale = basePageSize
    ? getDisplayScale(stageSize.width, stageSize.height, basePageSize.pageWidth, basePageSize.pageHeight)
    : 1;
  const previewWidth = basePageSize ? basePageSize.pageWidth * displayScale : 0;
  const previewHeight = basePageSize ? basePageSize.pageHeight * displayScale : 0;

  useEffect(() => {
    if (!dragState || !preview || !frameRef.current || displayScale <= 0) {
      return;
    }

    const activeDrag = dragState;
    const activePreview = preview;
    const activeDisplayScale = displayScale;

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerId !== activeDrag.pointerId) {
        return;
      }

      const frameRect = frameRef.current?.getBoundingClientRect();
      if (!frameRect) {
        return;
      }

      const left = clamp(
        event.clientX - frameRect.left - activeDrag.offsetX,
        0,
        Math.max(frameRect.width - activeDrag.stampWidth, 0),
      );
      const top = clamp(
        event.clientY - frameRect.top - activeDrag.offsetY,
        0,
        Math.max(frameRect.height - activeDrag.stampHeight, 0),
      );

      const centerXPercent = ((left + activeDrag.stampWidth / 2) / frameRect.width) * 100;
      const centerYPercent = ((frameRect.height - (top + activeDrag.stampHeight / 2)) / frameRect.height) * 100;

      const xPercent = roundPercent(centerXPercent - activeDrag.dragOffsetXPercent);
      const yPercent = roundPercent(centerYPercent - activeDrag.dragOffsetYPercent);

      setDragPreviewStamp({
        kind: "normal",
        x:
          ((xPercent + activeDrag.dragOffsetXPercent) / 100) * activePreview.pageWidth -
          activeDrag.stampWidth / activeDisplayScale / 2,
        y:
          ((yPercent + activeDrag.dragOffsetYPercent) / 100) * activePreview.pageHeight -
          activeDrag.stampHeight / activeDisplayScale / 2,
        width: activeDrag.stampWidth / activeDisplayScale,
        height: activeDrag.stampHeight / activeDisplayScale,
        opacity: activeDrag.opacity,
        rotationDegrees: activeDrag.rotationDegrees,
        imageUrl: activeDrag.imageUrl,
        dragOffsetXPercent: activeDrag.dragOffsetXPercent,
        dragOffsetYPercent: activeDrag.dragOffsetYPercent,
      });
    }

    function handlePointerUp(event: PointerEvent) {
      if (event.pointerId === activeDrag.pointerId) {
        if (dragPreviewStamp) {
          const centerXPercent =
            ((dragPreviewStamp.x + dragPreviewStamp.width / 2) / activePreview.pageWidth) * 100;
          const centerYPercent =
            ((dragPreviewStamp.y + dragPreviewStamp.height / 2) / activePreview.pageHeight) * 100;
          onNormalPositionChange(
            roundPercent(centerXPercent - activeDrag.dragOffsetXPercent),
            roundPercent(centerYPercent - activeDrag.dragOffsetYPercent),
          );
        }
        setDragState(null);
        setDragPreviewStamp(null);
      }
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [displayScale, dragPreviewStamp, dragState, onNormalPositionChange, preview]);

  function handleNormalStampPointerDown(event: ReactPointerEvent<HTMLImageElement>, stamp: PreviewStamp) {
    if (!preview || !frameRef.current) {
      return;
    }

    const frameRect = frameRef.current.getBoundingClientRect();
    const stampRect = event.currentTarget.getBoundingClientRect();
    const offsetX = event.clientX - stampRect.left;
    const offsetY = event.clientY - stampRect.top;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    setDragState({
      pointerId: event.pointerId,
      stampWidth: stampRect.width,
      stampHeight: stampRect.height,
      offsetX,
      offsetY,
      dragOffsetXPercent: stamp.dragOffsetXPercent ?? 0,
      dragOffsetYPercent: stamp.dragOffsetYPercent ?? 0,
      rotationDegrees: stamp.rotationDegrees,
      imageUrl: stamp.imageUrl,
      opacity: stamp.opacity,
    });
    setDragPreviewStamp(stamp);
  }

  const visibleStamps = useMemo(() => {
    if (!preview) {
      return [];
    }

    if (!dragPreviewStamp) {
      return preview.stamps;
    }

    const normalStamp = findNormalStamp(preview.stamps);
    if (!normalStamp) {
      return preview.stamps;
    }

    return preview.stamps.map((stamp) => (stamp === normalStamp ? dragPreviewStamp : stamp));
  }, [dragPreviewStamp, preview]);

  const previewForRender = preview;

  return (
    <section className="preview-panel">
      <div className="preview-header">
        <div>
          <p className="eyebrow">Live Preview</p>
          <h2>{activeLabel}</h2>
        </div>
        {files.length > 1 ? (
          <label className="file-switcher">
            <span>当前文件</span>
            <select value={file?.id ?? ""} onChange={(event) => onSelectFile(event.target.value)}>
              {files.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.file.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {file ? (
        <>
          <div className="preview-toolbar">
            <button disabled={currentPageIndex <= 0} onClick={() => onPageChange(currentPageIndex - 1)}>
              上一页
            </button>
            <button
              disabled={currentPageIndex >= file.pageCount - 1}
              onClick={() => onPageChange(currentPageIndex + 1)}
            >
              下一页
            </button>
          </div>

          <div ref={stageRef} className="preview-stage">
            {pageLoading ? <div className="overlay-message">正在加载页面...</div> : null}
            {previewLoading && !pageLoading ? <div className="overlay-message subtle">正在更新预览...</div> : null}
            {error ? <div className="overlay-message error">{error}</div> : null}

            <div
              ref={frameRef}
              className="page-frame"
              style={{ width: previewWidth || undefined, height: previewHeight || undefined }}
            >
              <canvas
                ref={canvasRef}
                className="pdf-canvas"
                style={{ width: previewWidth || undefined, height: previewHeight || undefined }}
              />
              {previewForRender && visibleStamps.length > 0
                ? visibleStamps.map((stamp, index) => {
                    const scaleX = displayScale;
                    const scaleY = displayScale;
                    const left = stamp.x * scaleX;
                    const top = previewForRender.pageHeight * displayScale - (stamp.y + stamp.height) * scaleY;
                    const width = stamp.width * scaleX;
                    const height = stamp.height * scaleY;

                    return (
                      <img
                        key={`${stamp.kind}-${index}-${stamp.x}-${stamp.y}`}
                        className={`stamp-overlay stamp-${stamp.kind}${stamp.kind === "normal" ? " stamp-draggable" : ""}`}
                        src={stamp.imageUrl}
                        alt=""
                        onPointerDown={
                          stamp.kind === "normal"
                            ? (event) => handleNormalStampPointerDown(event, stamp)
                            : undefined
                        }
                        style={{
                          left,
                          top,
                          width,
                          height,
                          opacity: stamp.opacity,
                          transformOrigin: "left bottom",
                          transform: `rotate(${stamp.rotationDegrees}deg)`,
                        }}
                      />
                    );
                  })
                : null}
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <h2>上传 PDF 后开始预览</h2>
          <p>左侧会显示当前页面预览，右侧用于调整骑缝章和普通印章参数。</p>
        </div>
      )}
    </section>
  );
}
