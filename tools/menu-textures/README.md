# Ảnh nền sách thực đơn (ảnh tạm)

Các ảnh trong `frontend/public/images/menu/` đều là **ảnh tạm**. Chúng được vẽ bằng script `gen-textures.mjs` (canvas trong trình duyệt, xuất WebP).
Khi có ảnh thật, **thay file nhưng giữ nguyên tên**. Không cần sửa code.

| File | Dùng cho | Kích thước gợi ý | Ghi chú |
|---|---|---|---|
| `paper-cream.webp` | Nền trang, phương án 1 (**mặc định**) | 900×1200 (3:4) | Giấy mỹ thuật / giấy cũ màu kem, vân nhẹ |
| `paper-lineart.webp` | Nền trang, phương án 2; trang trống cuối sách | 900×1200 | Nền sáng in mờ hoa văn line-art món ăn |
| `paper-kraft.webp` | Nền trang, phương án 3 | 900×1200 | Giấy kraft hoặc vải linen tông ấm |
| `wood-light.webp` | Nền bao quanh cuốn sách | 1600×1000, lặp liền mạch | Vân gỗ sáng |

Yêu cầu:
- Mỗi file là WebP dưới 200KB.
- Nền trang nên sáng, ít chi tiết. Chữ nằm trên một lớp phủ mờ (`--fb-card-bg` trong `flipbook.css`), nhưng nền quá đậm vẫn làm chữ khó đọc.

Chọn phương án nền:
- **Mặc định:** sửa `MENU_PAPER` trong `frontend/src/features/public-site/flipbook/theme.ts`.
- **Xem thử nhanh:** thêm `?nen=1`, `?nen=2` hoặc `?nen=3` vào địa chỉ, ví dụ `http://localhost:3000/thuc-don?nen=3`.

Tạo lại ảnh tạm (cần Microsoft Edge hoặc Chrome):

```bash
node tools/menu-textures/gen-textures.mjs
```
