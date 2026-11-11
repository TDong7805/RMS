import type { Dish, DishCategory } from '@/types';

/** [FAKE-DATA] Danh mục món. */
export const categorySeed: DishCategory[] = [
  { id: 'cat-1', name: 'Khai vị', active: true, sortOrder: 1 },
  { id: 'cat-2', name: 'Món chính', active: true, sortOrder: 2 },
  { id: 'cat-3', name: 'Lẩu', active: true, sortOrder: 3 },
  { id: 'cat-4', name: 'Cơm & mì', active: true, sortOrder: 4 },
  { id: 'cat-5', name: 'Tráng miệng', active: true, sortOrder: 5 },
  { id: 'cat-6', name: 'Đồ uống', active: true, sortOrder: 6 },
  { id: 'cat-7', name: 'Món theo mùa', active: false, sortOrder: 7 },
];

type D = [string, string, number, string, string[], number, string[], boolean, 'selling' | 'stopped', string];

const rows: D[] = [
  ['Gỏi cuốn tôm thịt', 'cat-1', 35000, 'Tôm, thịt ba chỉ, bún, rau sống, bánh tráng; chấm tương đậu phộng', ['Hải sản có vỏ', 'Đậu phộng'], 0, ['Bán chạy', 'Món nhẹ'], true, 'selling', 'Cuốn tươi mát, phù hợp mở đầu bữa ăn.'],
  ['Chả giò hải sản', 'cat-1', 65000, 'Tôm, mực, cà rốt, khoai môn, bánh tráng chiên', ['Hải sản có vỏ', 'Gluten (lúa mì)'], 0, ['Trẻ em thích'], true, 'selling', 'Giòn rụm, ăn kèm rau sống và nước mắm chua ngọt.'],
  ['Gỏi ngó sen tôm thịt', 'cat-1', 85000, 'Ngó sen, tôm, thịt heo, cà rốt, rau răm, đậu phộng rang', ['Hải sản có vỏ', 'Đậu phộng'], 1, ['Ít dầu mỡ'], true, 'selling', 'Vị chua ngọt thanh, giòn sần sật.'],
  ['Súp cua gà xé', 'cat-1', 55000, 'Thịt cua, gà xé, trứng, nấm tuyết', ['Hải sản có vỏ', 'Trứng'], 0, ['Món nhẹ'], true, 'selling', ''],
  ['Đậu hũ non sốt nấm', 'cat-1', 59000, 'Đậu hũ non, nấm đông cô, nấm rơm, hành lá', ['Đậu nành'], 0, ['Chay', 'Ít cay'], true, 'selling', 'Món chay mềm mịn, sốt nấm đậm đà.'],
  ['Bò lúc lắc khoai tây', 'cat-2', 165000, 'Thăn bò Úc, khoai tây chiên, ớt chuông, hành tây, bơ', ['Sữa'], 0, ['Bán chạy'], true, 'stopped', 'Bò mềm, sốt tiêu đen, ăn kèm khoai tây.'],
  ['Cá kho tộ', 'cat-2', 125000, 'Cá basa, nước màu, tiêu, ớt, hành', ['Cá'], 2, ['Món Việt truyền thống'], true, 'selling', 'Cá kho đậm vị miền Tây trong niêu đất.'],
  ['Gà nướng mật ong', 'cat-2', 145000, 'Đùi gà, mật ong, tỏi, sả, ớt', [], 1, ['Bán chạy', 'Trẻ em thích'], true, 'selling', ''],
  ['Sườn non rim mặn ngọt', 'cat-2', 135000, 'Sườn non heo, nước mắm, đường thốt nốt, tỏi phi', [], 0, ['Món Việt truyền thống'], true, 'selling', 'Đưa cơm, thơm mùi tỏi phi.'],
  ['Tôm sú rang muối ớt', 'cat-2', 225000, 'Tôm sú, muối hột, ớt hiểm, tỏi, lá chanh', ['Hải sản có vỏ'], 3, ['Cay'], true, 'selling', ''],
  ['Mực hấp gừng', 'cat-2', 175000, 'Mực ống, gừng, hành boa rô, nước mắm', ['Hải sản có vỏ'], 0, ['Ít dầu mỡ'], false, 'selling', ''],
  ['Lẩu Thái hải sản', 'cat-3', 395000, 'Tôm, mực, nghêu, cá, nấm, sả, lá chanh, ớt, nước cốt dừa', ['Hải sản có vỏ', 'Cá', 'Sữa'], 3, ['Cay', 'Nhóm 4 người'], true, 'selling', 'Nước lẩu chua cay đậm vị Thái, phần cho 3–4 người.'],
  ['Lẩu nấm chay', 'cat-3', 295000, 'Nấm đông cô, nấm kim châm, nấm đùi gà, đậu hũ, rau củ', ['Đậu nành'], 0, ['Chay', 'Ít cay', 'Nhóm 4 người'], true, 'selling', ''],
  ['Lẩu bò nhúng giấm', 'cat-3', 365000, 'Bắp bò, giấm, sả, hành tây, bánh tráng, rau sống', [], 1, ['Nhóm 4 người'], true, 'selling', ''],
  ['Cơm chiên cá mặn', 'cat-4', 95000, 'Cơm, cá mặn, trứng, hành lá, đậu que', ['Cá', 'Trứng'], 0, ['Trẻ em thích'], true, 'selling', ''],
  ['Mì xào hải sản', 'cat-4', 115000, 'Mì trứng, tôm, mực, cải ngọt, cà rốt', ['Hải sản có vỏ', 'Trứng', 'Gluten (lúa mì)'], 1, [], true, 'selling', ''],
  ['Cơm sen lá sen', 'cat-4', 105000, 'Gạo, hạt sen, lạp xưởng, nấm, đậu Hà Lan', [], 0, ['Món Việt truyền thống'], true, 'selling', ''],
  ['Chè hạt sen long nhãn', 'cat-5', 45000, 'Hạt sen, long nhãn, đường phèn', [], 0, ['Chay', 'Món nhẹ'], true, 'selling', ''],
  ['Bánh flan caramen', 'cat-5', 35000, 'Trứng, sữa tươi, caramen', ['Trứng', 'Sữa'], 0, ['Trẻ em thích'], true, 'selling', ''],
  ['Kem dừa', 'cat-5', 55000, '', [], 0, [], false, 'selling', 'Kem dừa trong trái dừa tươi.'],
  ['Trà sen vàng', 'cat-6', 49000, 'Trà xanh, hạt sen, kem sữa', ['Sữa'], 0, ['Bán chạy'], true, 'selling', ''],
  ['Nước ép dưa hấu', 'cat-6', 39000, 'Dưa hấu tươi', [], 0, ['Chay'], true, 'selling', ''],
  ['Cà phê sữa đá', 'cat-6', 32000, 'Cà phê phin, sữa đặc', ['Sữa'], 0, [], true, 'selling', ''],
  ['Bia Sài Gòn Special', 'cat-6', 30000, 'Bia lon 330ml', ['Gluten (lúa mì)'], 0, [], false, 'selling', ''],
  ['Cua rang me', 'cat-7', 450000, 'Cua thịt, me chua, tỏi, ớt', ['Hải sản có vỏ'], 2, ['Theo mùa'], true, 'stopped', 'Chỉ phục vụ mùa cua tháng 8 – 10.'],
];

const now = Date.now();

export const dishSeed: Dish[] = rows.map(
  ([name, categoryId, price, ingredients, allergens, spicyLevel, aiTags, usedInOrders, status, description], i) => {
    const updated = new Date(now - (i * 37 + 5) * 3_600_000).toISOString();
    return {
      id: `dish-${i + 1}`,
      code: `MA${String(i + 1).padStart(3, '0')}`,
      name,
      categoryId,
      price,
      description,
      image: null,
      status,
      ingredients,
      allergens,
      spicyLevel,
      aiTags,
      aiEnabled: status === 'selling',
      usedInOrders,
      createdAt: new Date(now - (200 - i * 5) * 86_400_000).toISOString(),
      updatedAt: updated,
      statusUpdatedAt: updated,
    };
  },
);

export const AI_TAG_OPTIONS = [
  'Bán chạy',
  'Chay',
  'Ít cay',
  'Cay',
  'Ít dầu mỡ',
  'Món nhẹ',
  'Trẻ em thích',
  'Nhóm 4 người',
  'Món Việt truyền thống',
  'Theo mùa',
];
