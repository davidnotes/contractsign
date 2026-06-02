请基于 TypeScript + React + Vite 开发一个 Web 版 PDF 骑缝章工具，参考 flytkgl/PDFQFZ 的功能，但不要复用其 C# 代码。

目标：
1. 纯前端运行，用户上传的 PDF 和印章图片都不上传服务器。
2. 使用 pdf-lib 修改 PDF，使用 pdf.js 做 PDF 页面预览，使用 Canvas API 处理印章图片裁切和旋转。
3. 支持上传一个或多个 PDF 文件。
4. 支持上传 PNG/JPG 印章图片，推荐保留透明背景。
5. 支持骑缝章：
   - 不加骑缝章
   - 全部页
   - 奇数页
   - 偶数页
   - 自定义页，例如 1,3,5-8
6. 支持骑缝章位置：
   - 左侧
   - 右侧
   - 顶部
   - 底部
7. 支持设置：
   - 印章物理宽度，单位 mm
   - 沿边缘方向的位置百分比，0-100
   - 最大分割页数 maxSplitCount
   - 透明度 opacity
8. 支持普通印章：
   - 不加
   - 首页
   - 尾页
   - 全部页
   - 自定义页
   - 支持 x/y 百分比定位
   - 支持随机偏移，范围 ±2%
   - 支持随机旋转，范围 ±2 度
9. 支持 PDF 页面旋转处理。页面 rotation 为 90 或 270 时，坐标计算需要交换页面宽高。
10. 支持预览：左侧显示 PDF 页面预览，右侧显示参数面板。预览中的印章位置要和最终导出一致。
11. 支持导出：
    - 单 PDF 时直接下载盖章后的 PDF
    - 多 PDF 时打包为 zip 下载

工程结构：
- src/core/types.ts
- src/core/pageSelector.ts
- src/core/imageProcessor.ts
- src/core/position.ts
- src/core/pdfStamp.ts
- src/components/FileUploader.tsx
- src/components/SealUploader.tsx
- src/components/PdfPreview.tsx
- src/components/ControlPanel.tsx
- src/App.tsx

核心实现要求：
1. imageProcessor.ts：
   - 实现 splitImageToParts(imageFile, count, edge)，返回 PNG Uint8Array 数组。
   - 当 edge 为 left/right 时，按水平方向切割完整印章图。
   - 当 edge 为 top/bottom 时，先按水平方向切割，再旋转 90 度，或直接按需要生成横向骑缝章切片。
2. pageSelector.ts：
   - 实现 selectPages(totalPages, mode, customPagesText)，返回从 0 开始的 pageIndex 数组。
   - customPagesText 支持 "1,3,5-8"。
3. position.ts：
   - 实现 mmToPt(mm) = mm * 72 / 25.4。
   - 实现 getEdgeStampPosition(pageWidth, pageHeight, imageWidth, imageHeight, edge, offsetPercent)。
   - 实现 getNormalStampPosition(pageWidth, pageHeight, imageWidth, imageHeight, xPercent, yPercent)。
4. pdfStamp.ts：
   - 使用 PDFDocument.load 读取 PDF。
   - 使用 embedPng/embedJpg 嵌入印章图片。
   - 使用 page.drawImage 写入图片。
   - 处理页面 width/height 和 rotation。
   - 导出 Uint8Array。

UI 要求：
1. 页面简洁，类似工具型 SaaS。
2. 左侧是 PDF 预览区域，支持上一页/下一页。
3. 右侧是参数区域：
   - PDF 上传
   - 印章上传
   - 骑缝章设置
   - 普通印章设置
   - 导出按钮
4. 所有错误要有清晰提示，例如：
   - 未上传 PDF
   - 未上传印章
   - 单页 PDF 不能加骑缝章
   - 自定义页超出范围
5. 不要实现登录、后端、数据库。

验收标准：
1. 上传一个 5 页 PDF 和一个圆形 PNG 印章，选择右侧骑缝章，导出的 PDF 每页右边缘出现连续切割后的骑缝章。
2. 选择左侧/顶部/底部时位置正确。
3. 选择奇数页/偶数页/自定义页时，只在对应页面盖骑缝章。
4. 普通印章可按 x/y 百分比盖到指定页面。
5. 预览位置和最终导出位置基本一致。