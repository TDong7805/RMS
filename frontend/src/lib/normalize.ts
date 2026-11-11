/**
 * Bỏ dấu tiếng Việt + hạ chữ thường để so khớp tìm kiếm không phân biệt dấu/hoa thường.
 * "Quản lý món ăn" -> "quan ly mon an"
 */
export function normalizeVi(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/** Trả về true nếu `text` chứa `keyword` sau khi bỏ dấu. */
export function matchesKeyword(text: string, keyword: string): boolean {
  const k = normalizeVi(keyword);
  if (!k) return true;
  return normalizeVi(text).includes(k);
}

/**
 * Tách `text` thành các đoạn khớp / không khớp `keyword` (đã bỏ dấu) để tô đậm.
 * Trả về mảng đoạn theo đúng thứ tự xuất hiện.
 */
export interface HighlightSegment {
  text: string;
  matched: boolean;
}

export function splitHighlight(text: string, keyword: string): HighlightSegment[] {
  const k = normalizeVi(keyword);
  if (!k) return [{ text, matched: false }];

  const normalized = normalizeVi(text);
  const segments: HighlightSegment[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const index = normalized.indexOf(k, cursor);
    if (index === -1) {
      segments.push({ text: text.slice(cursor), matched: false });
      break;
    }
    if (index > cursor) {
      segments.push({ text: text.slice(cursor, index), matched: false });
    }
    segments.push({ text: text.slice(index, index + k.length), matched: true });
    cursor = index + k.length;
  }

  return segments.length > 0 ? segments : [{ text, matched: false }];
}