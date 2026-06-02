import type { AppSettings, LoadedPdfFile, LoadedSealImage } from "../core/types";
import { FileUploader } from "./FileUploader";
import { SealUploader } from "./SealUploader";

interface ControlPanelProps {
  files: LoadedPdfFile[];
  seal: LoadedSealImage | null;
  settings: AppSettings;
  busy: boolean;
  error: string | null;
  onPdfSelect: (fileList: FileList | null) => void;
  onSealSelect: (fileList: FileList | null) => void;
  onEdgeChange: <K extends keyof AppSettings["edgeStamp"]>(
    key: K,
    value: AppSettings["edgeStamp"][K],
  ) => void;
  onNormalChange: <K extends keyof AppSettings["normalStamp"]>(
    key: K,
    value: AppSettings["normalStamp"][K],
  ) => void;
  onExport: () => void;
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const nextValue = Number(event.target.value);
          if (!Number.isNaN(nextValue)) {
            onChange(nextValue);
          }
        }}
      />
    </label>
  );
}

export function ControlPanel({
  files,
  seal,
  settings,
  busy,
  error,
  onPdfSelect,
  onSealSelect,
  onEdgeChange,
  onNormalChange,
  onExport,
}: ControlPanelProps) {
  return (
    <aside className="control-panel">
      <div className="panel-head">
        <p className="eyebrow">PDF Stamp Studio</p>
        <h1>合同盖章宝</h1>
      </div>

      <FileUploader files={files} onSelect={onPdfSelect} />
      <SealUploader seal={seal} onSelect={onSealSelect} />

      <section className="panel-section">
        <div className="section-header">
          <h3>骑缝章设置</h3>
          <span>{settings.edgeStamp.mode === "none" ? "未启用" : "已启用"}</span>
        </div>

        <div className="field-grid">
          <label className="field">
            <span>盖章页</span>
            <select
              value={settings.edgeStamp.mode}
              onChange={(event) => onEdgeChange("mode", event.target.value as AppSettings["edgeStamp"]["mode"])}
            >
              <option value="none">不加骑缝章</option>
              <option value="all">全部页</option>
              <option value="odd">奇数页</option>
              <option value="even">偶数页</option>
              <option value="custom">自定义页</option>
            </select>
          </label>

          <label className="field">
            <span>位置</span>
            <select
              value={settings.edgeStamp.edge}
              onChange={(event) => onEdgeChange("edge", event.target.value as AppSettings["edgeStamp"]["edge"])}
            >
              <option value="left">左侧</option>
              <option value="right">右侧</option>
              <option value="top">顶部</option>
              <option value="bottom">底部</option>
            </select>
          </label>

          <NumberField
            label="印章宽度 (mm)"
            value={settings.edgeStamp.widthMm}
            min={5}
            max={120}
            step={1}
            onChange={(value) => onEdgeChange("widthMm", value)}
          />

          <NumberField
            label="边缘偏移 (%)"
            value={settings.edgeStamp.offsetPercent}
            min={0}
            max={100}
            step={1}
            onChange={(value) => onEdgeChange("offsetPercent", value)}
          />

          <NumberField
            label="最大分割页数"
            value={settings.edgeStamp.maxSplitCount}
            min={1}
            max={50}
            step={1}
            onChange={(value) => onEdgeChange("maxSplitCount", value)}
          />

          <NumberField
            label="透明度"
            value={settings.edgeStamp.opacity}
            min={0.05}
            max={1}
            step={0.05}
            onChange={(value) => onEdgeChange("opacity", value)}
          />
        </div>

        {settings.edgeStamp.mode === "custom" ? (
          <label className="field">
            <span>自定义页</span>
            <input
              type="text"
              value={settings.edgeStamp.customPagesText}
              placeholder="例如 1,3,5-8"
              onChange={(event) => onEdgeChange("customPagesText", event.target.value)}
            />
          </label>
        ) : null}
      </section>

      <section className="panel-section">
        <div className="section-header">
          <h3>普通印章设置</h3>
          <span>{settings.normalStamp.mode === "none" ? "未启用" : "已启用"}</span>
        </div>

        <div className="field-grid">
          <label className="field">
            <span>盖章页</span>
            <select
              value={settings.normalStamp.mode}
              onChange={(event) =>
                onNormalChange("mode", event.target.value as AppSettings["normalStamp"]["mode"])
              }
            >
              <option value="none">不加普通印章</option>
              <option value="first">首页</option>
              <option value="last">尾页</option>
              <option value="all">全部页</option>
              <option value="custom">自定义页</option>
            </select>
          </label>

          <NumberField
            label="X 百分比"
            value={settings.normalStamp.xPercent}
            min={0}
            max={100}
            step={1}
            onChange={(value) => onNormalChange("xPercent", value)}
          />

          <NumberField
            label="Y 百分比"
            value={settings.normalStamp.yPercent}
            min={0}
            max={100}
            step={1}
            onChange={(value) => onNormalChange("yPercent", value)}
          />

          <NumberField
            label="随机偏移范围 (%)"
            value={settings.normalStamp.randomOffsetPercent}
            min={0}
            max={10}
            step={0.5}
            onChange={(value) => onNormalChange("randomOffsetPercent", value)}
          />

          <NumberField
            label="随机旋转范围 (度)"
            value={settings.normalStamp.randomRotateDegrees}
            min={0}
            max={10}
            step={0.5}
            onChange={(value) => onNormalChange("randomRotateDegrees", value)}
          />
        </div>

        {settings.normalStamp.mode === "custom" ? (
          <label className="field">
            <span>自定义页</span>
            <input
              type="text"
              value={settings.normalStamp.customPagesText}
              placeholder="例如 2,4,6-7"
              onChange={(event) => onNormalChange("customPagesText", event.target.value)}
            />
          </label>
        ) : null}

        {settings.normalStamp.mode !== "none" ? (
          <div className="hint-card">普通印章可在左侧直接拖动，松手后同步 X / Y。</div>
        ) : null}
      </section>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <button className="export-button" disabled={busy} onClick={onExport}>
        {busy ? "正在导出..." : files.length > 1 ? "导出 ZIP" : "导出 PDF"}
      </button>
    </aside>
  );
}
