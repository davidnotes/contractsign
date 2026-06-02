import type { LoadedSealImage } from "../core/types";

interface SealUploaderProps {
  seal: LoadedSealImage | null;
  onSelect: (fileList: FileList | null) => void;
}

export function SealUploader({ seal, onSelect }: SealUploaderProps) {
  return (
    <section className="panel-section">
      <div className="section-header">
        <h3>印章上传</h3>
        <span>{seal ? seal.file.name : "未选择"}</span>
      </div>
      <label className="upload-card">
        <input
          className="sr-only"
          type="file"
          accept="image/png,image/jpeg,.png,.jpg,.jpeg"
          onChange={(event) => onSelect(event.target.files)}
        />
        <span className="upload-title">选择 PNG / JPG 印章</span>
        <span className="upload-hint">推荐透明 PNG。</span>
      </label>
      {seal ? (
        <div className="seal-preview">
          <img src={seal.dataUrl} alt="seal preview" />
          <div>
            <strong>{seal.width} × {seal.height}</strong>
            <p>普通章与骑缝章共用。</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
