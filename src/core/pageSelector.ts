import type { PageSelectionMode } from "./types";

function pushRange(result: number[], start: number, end: number): void {
  for (let page = start; page <= end; page += 1) {
    result.push(page - 1);
  }
}

export function selectPages(
  totalPages: number,
  mode: PageSelectionMode,
  customPagesText = "",
): number[] {
  if (totalPages <= 0) {
    return [];
  }

  switch (mode) {
    case "none":
      return [];
    case "all":
      return Array.from({ length: totalPages }, (_, index) => index);
    case "odd":
      return Array.from({ length: totalPages }, (_, index) => index).filter(
        (index) => (index + 1) % 2 === 1,
      );
    case "even":
      return Array.from({ length: totalPages }, (_, index) => index).filter(
        (index) => (index + 1) % 2 === 0,
      );
    case "first":
      return [0];
    case "last":
      return [totalPages - 1];
    case "custom":
      break;
    default:
      return [];
  }

  const text = customPagesText.trim();
  if (!text) {
    throw new Error("请填写自定义页码，例如 1,3,5-8");
  }

  const result: number[] = [];

  for (const rawToken of text.split(",")) {
    const token = rawToken.trim();
    if (!token) {
      continue;
    }

    if (/^\d+$/.test(token)) {
      const page = Number(token);
      if (page < 1 || page > totalPages) {
        throw new Error(`自定义页超出范围：${page}`);
      }
      result.push(page - 1);
      continue;
    }

    const rangeMatch = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (start > end) {
        throw new Error(`页码区间无效：${token}`);
      }
      if (start < 1 || end > totalPages) {
        throw new Error(`自定义页超出范围：${token}`);
      }
      pushRange(result, start, end);
      continue;
    }

    throw new Error(`无法识别的页码格式：${token}`);
  }

  return [...new Set(result)].sort((left, right) => left - right);
}
