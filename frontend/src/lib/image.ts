/** Cạnh dài tối đa của ảnh gửi lên — trùng ImageProcessor.MAX_SIDE ở backend. */
const MAX_SIDE = 1200;
/** Backend nhận tối đa 2 MB sau khi giải mã base64. */
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Chuẩn bị ảnh trước khi gửi: xoay đúng chiều theo EXIF (ảnh chụp bằng điện thoại), thu nhỏ cạnh dài về 1200px.
 * Trả về data URL — JPG, hoặc PNG nếu ảnh thật sự có vùng trong suốt.
 *
 * Backend vẫn tự kiểm tra và xử lý lại ảnh; bước này giúp ảnh hiển thị đúng chiều (backend bỏ dữ liệu EXIF)
 * và giảm dung lượng tải lên.
 */
export async function prepareImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    for (const side of [MAX_SIDE, 900, 600]) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh');
      ctx.drawImage(bitmap, 0, 0, w, h);
      const url = hasTransparency(ctx, w, h) ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.9);
      if (approxBytes(url) <= MAX_BYTES) return url;
    }
    throw new Error('Ảnh tối đa 2 MB');
  } finally {
    bitmap.close();
  }
}

function hasTransparency(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const { data } = ctx.getImageData(0, 0, w, h);
  for (let i = 3; i < data.length; i += 4 * 7) if (data[i] < 255) return true;
  return false;
}

function approxBytes(dataUrl: string): number {
  return Math.floor(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);
}
