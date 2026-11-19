# Nguồn hình ảnh / tranh động của trang đặt món (QR)

## Emoji 3D — `emoji/*.webp`
Bộ **Fluent Emoji** của Microsoft (https://github.com/microsoft/fluentui-emoji), giấy phép **MIT**.
Đã thu nhỏ về 160×160 và đổi sang webp. Danh mục món chọn emoji theo tên (xem `categoryEmoji` trong `src/features/ordering/QrParts.tsx`).

## Tranh động trạng thái — `lottie/sent|cooking|ready|served.json`

Tải từ **LottieFiles** (https://lottiefiles.com/free-animations), Lottie Simple License (miễn phí, kể cả thương mại, không bắt
buộc ghi công). Đã **tô lại màu Royal Beef** (đỏ rượu / vàng đồng / kem / nâu) và bỏ lớp nền; trang đặt tranh trên "đĩa" kem
viền vàng đồng kèm hiệu ứng nền (quầng sáng, tàn lửa, vòng sóng chuông, lấp lánh).

| File | Mẫu gốc (mã khi chọn) | Dùng ở |
|---|---|---|
| sent.json | paper-plane-1 (máy bay giấy) | Màn "Đã gửi tới bếp"; theo dõi đơn: Đã gửi |
| cooking.json | nồi nấu bỏ món vào — https://assets-v2.lottiefiles.com/a/be3bccf4-1175-11ee-adf0-fb8b7528a547/jwHKS8WCqu.lottie | Theo dõi đơn: Đang nấu (tô riêng: bỏ nền tròn, thìa gỗ nâu, nồi đỏ rượu nắp vàng, rau củ giữ màu tự nhiên) |
| ready.json | bell-0 (chuông phục vụ) | Theo dõi đơn: Sẵn sàng; hộp "đang chờ nhân viên" |
| served.json | restaurant-2 (tách trà bốc khói) | Theo dõi đơn: Đã mang ra; màn cảm ơn; trang mã QR lỗi / bàn tạm ngừng |

## Tranh động giỏ trống — `lottie/empty-cart.json`

Tải từ **LottieFiles** (https://lottiefiles.com/free-animations), Lottie Simple License (miễn phí, kể cả thương mại):
https://assets-v2.lottiefiles.com/a/baecfb84-1163-11ee-987a-43f0d6e32e4c/j8oSOSfbMX.lottie
