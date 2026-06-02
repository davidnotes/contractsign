import type { LoadedPdfFile } from "../core/types";

interface FileUploaderProps {
  files: LoadedPdfFile[];
  onSelect: (fileList: FileList | null) => void;
}

export function FileUploader({ files, onSelect }: FileUploaderProps) {
  return (
    <section className="panel-section">
      <div className="section-header">
        <h3>PDF 上传</h3>
        <span>{files.length > 1 ? `${files.length} 个文件` : files.length === 1 ? "1 个文件" : "未选择"}</span>
      </div>
      <label className="upload-card">
        <input
          className="sr-only"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          onChange={(event) => onSelect(event.target.files)}
        />
        <span className="upload-title">选择一个或多个 PDF</span>
        <span className="upload-hint">仅浏览器本地处理。</span>
      </label>
      {files.length > 0 ? (
        <ul className="file-list">
          {files.map((file) => (
            <li key={file.id}>
              <span>{file.file.name}</span>
              <span>{file.pageCount} 页</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
