/**
 * Tùy chọn cho bếp ở màn chi tiết món, tự chọn theo danh mục / tên món (miễn phí, không đổi giá).
 * Lựa chọn được ghép vào ghi chú của dòng món, vd. "Medium rare, Sốt tiêu đen, Không hành".
 *
 *  - Bít tết (và món có tên phần thịt bít tết): chọn 1 "Độ chín" (mặc định Medium rare) + chọn 1 "Sốt kèm".
 *  - Món khác: ghi chú nhanh hợp loại món (lẩu không có "Không đá", đồ uống không có "Không hành"…).
 */

export interface SingleGroup {
  key: string;
  title: string;
  options: string[];
  /** Giá trị chọn sẵn. */
  initial: string;
  /** Tiền tố khi ghép vào ghi chú, vd. "Sốt " → "Sốt tiêu đen". */
  notePrefix?: string;
  /** Vẽ dải màu độ chín dưới các lựa chọn. */
  doneness?: boolean;
}

export interface DishOptions {
  groups: SingleGroup[];
  quickNotes: string[];
}

export const DONENESS = ['Tái', 'Medium rare', 'Medium', 'Medium well', 'Chín kỹ'];
const SAUCES = ['Tiêu đen', 'Nấm', 'Vang đỏ', 'Không sốt'];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();

const isSteak = (cat: string, name: string) =>
  /bit tet|steak/.test(cat) || (/ribeye|striploin|tenderloin|t-bone|tomahawk|wagyu a5|thit than/.test(name) && !/pho|lau|shabu|com|burger/.test(name));

export function dishOptions(categoryName = '', dishName = ''): DishOptions {
  const cat = norm(categoryName);
  const name = norm(dishName);

  if (isSteak(cat, name)) {
    const groups: SingleGroup[] = [{ key: 'doneness', title: 'Độ chín', options: DONENESS, initial: 'Medium rare', doneness: true }];
    // Bít tết chảo gang kiểu Việt đã có sốt riêng.
    if (!/chao gang/.test(name)) groups.push({ key: 'sauce', title: 'Sốt kèm', options: SAUCES, initial: 'Tiêu đen', notePrefix: 'Sốt ' });
    return { groups, quickNotes: ['Ít muối', 'Cắt sẵn', 'Không rau củ kèm'] };
  }
  if (/do uong|nuoc uong|thuc uong/.test(cat)) {
    if (/vang|bia|ruou/.test(name)) return { groups: [], quickNotes: ['Ướp lạnh', 'Thêm đá', 'Mang ra trước'] };
    return { groups: [], quickNotes: ['Ít đá', 'Không đá', 'Ít ngọt', 'Mang ra trước'] };
  }
  if (/trang mieng|dessert|kem|che/.test(cat)) return { groups: [], quickNotes: ['Ít ngọt', 'Ít đá', 'Mang ra sau cùng'] };
  if (/lau/.test(cat)) return { groups: [], quickNotes: ['Ít cay', 'Nước lẩu nhạt', 'Thêm nước chấm', 'Không hành'] };
  if (/mon nuoc|pho|bun|hu tieu/.test(cat)) return { groups: [], quickNotes: ['Không hành', 'Nhiều nước', 'Ít béo', 'Ít cay'] };
  if (/nuong|ap chao/.test(cat)) return { groups: [], quickNotes: ['Ít cay', 'Không hành', 'Thêm nước chấm', 'Ít muối'] };
  if (/khai vi/.test(cat)) {
    // Món bò tái: khách có thể nhờ bếp làm chín hơn.
    const tai = /tai|tataki/.test(name) ? ['Chín hơn'] : [];
    return { groups: [], quickNotes: ['Ít cay', 'Không hành', 'Không đậu phộng', 'Thêm nước chấm', ...tai] };
  }
  if (/goi them/.test(cat)) return { groups: [], quickNotes: [] };
  if (/com|mi|burger/.test(cat)) return { groups: [], quickNotes: ['Không hành', 'Ít cay', 'Không rau'] };
  if (/chay/.test(cat)) return { groups: [], quickNotes: ['Ít cay', 'Không hành', 'Ít dầu'] };
  return { groups: [], quickNotes: ['Ít cay', 'Không hành'] };
}

/** Ghép lựa chọn thành ghi chú gửi bếp. */
export function buildNote(groups: SingleGroup[], chosen: Record<string, string>, picked: string[], extra: string) {
  const parts = groups.map((g) => {
    const v = chosen[g.key];
    if (!v) return '';
    if (g.key === 'sauce' && v === 'Không sốt') return v;
    return g.notePrefix ? g.notePrefix + v.charAt(0).toLowerCase() + v.slice(1) : v;
  });
  return [...parts, ...picked, extra.trim()].filter(Boolean).join(', ');
}

/** Ghi chú mặc định khi thêm nhanh bằng nút + (không mở chi tiết): bít tết ghi rõ độ chín và sốt mặc định cho bếp. */
export function defaultNote(categoryName = '', dishName = ''): string {
  const { groups } = dishOptions(categoryName, dishName);
  if (!groups.length) return '';
  return buildNote(groups, Object.fromEntries(groups.map((g) => [g.key, g.initial])), [], '');
}

/**
 * Món "Gọi thêm" nên gợi ý trong màn chi tiết của một món (theo danh mục / tên món): trả về các từ khóa tên món gọi thêm.
 * Bít tết: khoai nghiền, salad, bánh mì bơ tỏi, sốt; lẩu: bò nhúng, rau nấm, bún; súp / bò kho: bánh mì; bún bò: bún.
 */
export function addonKeywords(categoryName = '', dishName = ''): string[] {
  const cat = norm(categoryName);
  const name = norm(dishName);
  if (isSteak(cat, name)) return ['khoai tay nghien', 'salad', 'banh mi bo toi', 'sot tieu den', 'sot nam', 'sot vang'];
  if (/lau/.test(cat)) return ['bo uc nhung', 'rau nam', 'bun tuoi'];
  if (/sup|bo kho/.test(name)) return ['banh mi bo toi'];
  if (/bun bo/.test(name)) return ['bun tuoi'];
  return [];
}

/** Lọc món gọi thêm (danh mục "Gọi thêm") khớp từ khóa, giữ thứ tự từ khóa. */
export function pickAddons<T extends { name: string; categoryId: string }>(keywords: string[], dishes: T[], addonCategoryId: string | undefined): T[] {
  if (!addonCategoryId || !keywords.length) return [];
  const pool = dishes.filter((d) => d.categoryId === addonCategoryId);
  return keywords.map((k) => pool.find((d) => norm(d.name).includes(k))).filter((d): d is T => Boolean(d));
}
