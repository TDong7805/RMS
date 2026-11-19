# Công thức định lượng: bản nháp cho đợt sửa thực đơn

> **Trạng thái:** đã đưa vào dữ liệu mẫu (19/11/2026) — `backend/database/kho-seed/gen-v7_1.mjs` (nguyên liệu, liên kết
> nhà cung cấp, `RECIPES`) → `V7_1__kho_mau.sql`. Đã chỉnh lượng xương nấu nước dùng / thịt ở vài món cho giá vốn
> trung bình khoảng 40% giá bán (bò nhập khẩu: vài món 52–58%).
> Sau đó Bếp vẫn sửa được ở trang **Công thức** (`/bep/cong-thuc`).

## Quy ước

- **Định lượng cho 1 phần** (1 đĩa / 1 tô / 1 nồi lẩu / 1 ly), đúng đơn vị tồn kho của nguyên liệu.
- Thịt và rau tính theo **khối lượng sống lấy từ Kho** (quyết định B7), đã cộng hao hụt khi sơ chế và nướng.
  Ví dụ steak 250g thì lấy 0,27 kg thịt sống.
- **Nước chấm miễn phí** đi kèm món (mắm nêm, muối tiêu chanh, chao, tương…) được tính luôn vào công thức của món.
- **Sốt kèm steak** (khách chọn Tiêu đen / Nấm / Vang đỏ / Không sốt): công thức tính theo lựa chọn mặc định **Tiêu đen**.
  Khách đổi sốt thì lượng trừ kho lệch một chút. Chấp nhận được, sau này có thể làm chính xác hơn.
- Các sốt nền (tiêu đen, nấm, vang đỏ) và sốt BBQ coi là **sốt pha sẵn** nhập theo lít (bếp trung tâm / nhà cung cấp),
  không tách thành bơ, kem, tiêu… vì hệ thống chưa có "bán thành phẩm".
- Gia vị dùng rất ít (dưới khoảng 2 g mỗi phần: bột ngọt, hạt nêm…) **không ghi**. Chỉ ghi muối, tiêu, đường khi dùng đáng kể.
- Lẩu là phần cho **2–3 người**.
- Cột **Tình trạng**: `giữ` là công thức hiện có, không đổi; `chỉnh` là công thức hiện có, có sửa; `mới` là món chưa có công thức.
- **Ảnh hưởng khi áp dụng:** đổi công thức có sẵn làm thay đổi giá vốn món. Bộ test `tests/api/04-cham-cong-luong-cong-thuc.mjs`
  có bước dựa trên công thức mẫu, cần rà lại khi đưa vào dữ liệu.

---

## 1. Nguyên liệu

### 1.1. Đang có trong Kho (NL001–NL029)

| Mã | Nguyên liệu | Đơn vị | | Mã | Nguyên liệu | Đơn vị |
|---|---|---|---|---|---|---|
| NL001 | Thăn ngoại bò Úc (striploin) | kg | | NL016 | Cà chua | kg |
| NL002 | Thăn nội bò Úc (tenderloin) | kg | | NL017 | Hành lá | kg |
| NL003 | Ribeye bò Úc | kg | | NL018 | Rau thơm các loại | bó |
| NL004 | Bắp bò | kg | | NL019 | Khoai tây | kg |
| NL005 | Bánh phở tươi | kg | | NL020 | Gạo ST25 | kg |
| NL006 | Nấm đông cô | kg | | NL021 | Bún bò Huế (sợi to) | kg |
| NL007 | Ribeye Wagyu Úc MB4+ | kg | | NL022 | Trứng gà | quả |
| NL008 | Đuôi bò | kg | | NL023 | Bơ lạt | kg |
| NL009 | Sườn bò Úc (short rib) | kg | | NL024 | Nước mắm Phú Quốc | chai (500 ml) |
| NL010 | T-bone bò Úc | kg | | NL025 | Dầu ăn | lít |
| NL011 | Ba chỉ bò Úc | kg | | NL026 | Bia thủ công Úc (chai 330ml) | chai |
| NL012 | Lưỡi bò | kg | | NL027 | Vang đỏ Úc (chai 750ml) | chai |
| NL013 | Gân & nạm bò | kg | | NL028 | Lá lốt | kg |
| NL014 | Xương bò (nấu nước dùng) | kg | | NL029 | Ba chỉ bò Mỹ (ngừng dùng) | kg |
| NL015 | Rau xà lách | kg | | | | |

### 1.2. Cần thêm (NL030–NL106)

Nhà cung cấp gợi ý theo 6 nhà cung cấp mẫu:
- (1) Úc Châu: bò nhập khẩu
- (2) Đại Phát: thực phẩm
- (3) Đà Lạt Xanh: rau
- (4) Minh Phát: đồ uống
- (5) Hương Việt: gia vị
- (6) Phương Nam: bò

Giá là **giá vốn ước lượng** cho mỗi đơn vị tồn kho.

**Thịt**

| Mã | Nguyên liệu | Nhóm | Đơn vị | NCC | Mua theo | Giá / đơn vị | Tồn tối thiểu |
|---|---|---|---|---|---|---|---|
| NL030 | Tomahawk bò Úc | meat | kg | 1 | kg | 650.000 | 3 |
| NL031 | Thịt bò xay | meat | kg | 2 | kg | 240.000 | 3 |
| NL032 | Bò Wagyu A5 Nhật (theo mùa) | meat | kg | 1 | kg | 4.500.000 | 0 |

**Rau, củ, quả**

| Mã | Nguyên liệu | Đơn vị | NCC | Mua theo | Giá / đơn vị | Tồn tối thiểu |
|---|---|---|---|---|---|---|
| NL033 | Hành tây | kg | 3 | kg | 25.000 | 5 |
| NL034 | Ớt chuông (đỏ, vàng) | kg | 3 | kg | 60.000 | 2 |
| NL035 | Tỏi | kg | 3 | kg | 50.000 | 1 |
| NL036 | Ớt tươi | kg | 3 | kg | 60.000 | 0,5 |
| NL037 | Chanh | kg | 3 | kg | 30.000 | 2 |
| NL038 | Sả | kg | 3 | kg | 25.000 | 1 |
| NL039 | Gừng | kg | 3 | kg | 40.000 | 0,5 |
| NL040 | Dưa leo | kg | 3 | kg | 20.000 | 2 |
| NL041 | Cà rốt | kg | 3 | kg | 22.000 | 3 |
| NL042 | Củ cải trắng | kg | 3 | kg | 18.000 | 2 |
| NL043 | Măng tây | kg | 3 | kg | 120.000 | 1 |
| NL044 | Bắp Mỹ | quả | 3 | quả | 8.000 | 10 |
| NL045 | Bắp cải (trắng, tím) | kg | 3 | kg | 20.000 | 2 |
| NL046 | Rau muống | kg | 3 | kg | 20.000 | 2 |
| NL047 | Cải thảo | kg | 3 | kg | 22.000 | 2 |
| NL048 | Cải ngọt / cải bẹ xanh | kg | 3 | kg | 25.000 | 2 |
| NL049 | Nấm kim châm | kg | 3 | kg | 60.000 | 1 |
| NL050 | Nấm đùi gà | kg | 3 | kg | 90.000 | 1 |
| NL051 | Khoai môn | kg | 3 | kg | 35.000 | 1 |
| NL052 | Thơm (dứa) | quả | 3 | quả | 15.000 | 4 |
| NL053 | Cam tươi | kg | 3 | kg | 35.000 | 5 |
| NL054 | Hành baro | kg | 3 | kg | 70.000 | 0,5 |
| NL055 | Ớt xanh (shishito) | kg | 3 | kg | 120.000 | 0,3 |

**Bánh, sợi, đồ khô**

| Mã | Nguyên liệu | Đơn vị | NCC | Mua theo | Giá / đơn vị | Tồn tối thiểu |
|---|---|---|---|---|---|---|
| NL056 | Bánh mì baguette | cái | 2 | cái | 5.000 | 20 |
| NL057 | Bánh burger (brioche) | cái | 2 | túi 6 cái | 9.000 | 12 |
| NL058 | Mì Ý spaghetti | kg | 2 | gói 500 g | 70.000 | 2 |
| NL059 | Mì trứng sợi nhỏ | kg | 2 | kg | 60.000 | 2 |
| NL060 | Hủ tiếu sợi | kg | 2 | kg | 25.000 | 3 |
| NL061 | Bún tươi (sợi nhỏ) | kg | 3 | kg | 15.000 | 5 |
| NL062 | Bánh tráng | gói (20 lá) | 2 | gói | 15.000 | 5 |
| NL063 | Đậu phộng rang | kg | 5 | kg | 80.000 | 0,5 |
| NL064 | Hành phi | kg | 5 | kg | 120.000 | 0,5 |
| NL065 | Đậu hũ non | kg | 2 | kg | 30.000 | 1 |
| NL066 | Gói thuốc bắc hầm lẩu (táo đỏ, kỷ tử, đẳng sâm) | gói | 5 | gói | 45.000 | 5 |
| NL067 | Gia vị nấu nước dùng (quế, hồi, thảo quả) | kg | 5 | kg | 300.000 | 0,3 |

**Sữa, kem, phô mai**

| Mã | Nguyên liệu | Đơn vị | NCC | Mua theo | Giá / đơn vị | Tồn tối thiểu |
|---|---|---|---|---|---|---|
| NL068 | Phô mai cheddar | kg | 2 | kg | 280.000 | 1 |
| NL069 | Phô mai parmesan | kg | 2 | kg | 600.000 | 0,3 |
| NL070 | Sữa tươi không đường | lít | 2 | thùng 12 hộp 1 lít | 35.000 | 5 |
| NL071 | Kem tươi (whipping cream) | lít | 2 | lít | 140.000 | 2 |
| NL072 | Kem vani | lít | 2 | hộp 4 lít | 150.000 | 4 |

**Gia vị, nước chấm, sốt**

| Mã | Nguyên liệu | Đơn vị | NCC | Mua theo | Giá / đơn vị | Tồn tối thiểu |
|---|---|---|---|---|---|---|
| NL073 | Tiêu đen hạt | kg | 5 | kg | 250.000 | 0,5 |
| NL074 | Muối | kg | 5 | kg | 10.000 | 2 |
| NL075 | Đường | kg | 5 | kg | 22.000 | 5 |
| NL076 | Sa tế | kg | 5 | kg | 150.000 | 0,5 |
| NL077 | Mắm nêm | lít | 5 | lít | 60.000 | 1 |
| NL078 | Chao | kg | 5 | kg | 80.000 | 0,5 |
| NL079 | Tương đen | lít | 5 | lít | 70.000 | 1 |
| NL080 | Tương ớt | lít | 5 | lít | 50.000 | 1 |
| NL081 | Nước tương | lít | 5 | lít | 45.000 | 1 |
| NL082 | Sốt ponzu | lít | 5 | lít | 180.000 | 0,5 |
| NL083 | Wasabi | kg | 5 | kg | 400.000 | 0,1 |
| NL084 | Sốt BBQ | lít | 5 | lít | 120.000 | 1 |
| NL085 | Cà chua nghiền (sốt cà chua) | kg | 2 | kg | 60.000 | 2 |
| NL086 | Dầu ô liu | lít | 2 | lít | 220.000 | 1 |
| NL087 | Giấm | lít | 5 | lít | 25.000 | 1 |
| NL088 | Sốt tiêu đen pha sẵn | lít | 5 | lít | 180.000 | 2 |
| NL089 | Sốt nấm pha sẵn | lít | 5 | lít | 200.000 | 1 |
| NL090 | Sốt vang đỏ pha sẵn | lít | 5 | lít | 260.000 | 1 |
| NL091 | Sốt sô-cô-la | lít | 2 | lít | 180.000 | 0,5 |
| NL092 | Hạnh nhân lát | kg | 2 | kg | 400.000 | 0,2 |
| NL093 | Vải ngâm | lon | 2 | lon 565 g | 45.000 | 6 |
| NL094 | Bột gelatin | kg | 2 | kg | 500.000 | 0,1 |
| NL095 | Đào ngâm | lon | 2 | lon 820 g | 55.000 | 6 |
| NL096 | Trà đen túi lọc | túi | 2 | hộp 100 túi | 1.500 | 50 |
| NL097 | Bánh quế cuộn | cái | 2 | hộp 50 cái | 2.000 | 30 |
| NL106 | Gói nước dùng dashi | gói | 5 | gói | 20.000 | 5 |

**Đồ uống** (NCC 4: Minh Phát)

| Mã | Nguyên liệu | Đơn vị | Mua theo | Giá / đơn vị | Tồn tối thiểu |
|---|---|---|---|---|---|
| NL098 | Coca-Cola (lon 330ml) | lon | thùng 24 lon | 9.000 | 48 |
| NL099 | Coca-Cola Zero (lon 330ml) | lon | thùng 24 lon | 9.500 | 24 |
| NL100 | Sprite (lon 330ml) | lon | thùng 24 lon | 9.000 | 24 |
| NL101 | Fanta Cam (lon 330ml) | lon | thùng 24 lon | 9.000 | 24 |
| NL102 | Fanta Nho (lon 330ml) | lon | thùng 24 lon | 9.000 | 24 |
| NL103 | Sá xị Chương Dương (lon 330ml) | lon | thùng 24 lon | 8.500 | 24 |
| NL104 | Nước suối (chai 500ml) | chai | thùng 24 chai | 5.000 | 48 |
| NL105 | Bia tươi | lít | bom 20 lít | 45.000 | 20 |

---

## 2. Công thức theo món

Ký hiệu đơn vị: kg, lít, bó, quả, cái, gói, lon, chai, túi. Số thập phân dùng dấu phẩy.

### Khai vị

| Mã | Món | Định lượng / 1 phần | Tình trạng |
|---|---|---|---|
| MA001 | Bò cuốn lá lốt nướng (6 cuốn) | Thịt bò xay 0,15 kg · Lá lốt 0,03 kg · Hành lá 0,01 kg · Đậu phộng rang 0,01 kg · Dầu ăn 0,01 lít · Rau xà lách 0,04 kg · Rau thơm 0,2 bó · Bún tươi 0,08 kg · *Chấm:* Mắm nêm 0,03 lít · Thơm 0,05 quả · Ớt tươi 0,003 kg | chỉnh (ba chỉ → bò xay, thêm nước chấm) |
| MA002 | Gỏi bò tái chanh | Bắp bò 0,12 kg · Hành tây 0,05 kg · Chanh 0,04 kg · Rau thơm 0,3 bó · Ớt tươi 0,005 kg · Đậu phộng rang 0,015 kg · Hành phi 0,01 kg · Nước mắm 0,03 chai · Đường 0,01 kg | chỉnh (thêm rau, nước trộn) |
| MA003 | Bò Úc tataki sốt ponzu | Thăn ngoại bò Úc 0,13 kg · Củ cải trắng 0,04 kg · Hành lá 0,01 kg · Sốt ponzu 0,04 lít · Dầu ăn 0,005 lít | mới |
| MA004 | Khoai tây chiên phô mai bò băm | Khoai tây 0,2 kg · Dầu ăn 0,05 lít · Thịt bò xay 0,08 kg · Phô mai cheddar 0,04 kg · Hành phi 0,01 kg · Ớt tươi 0,003 kg | mới |
| MA005 | Súp bò hầm rau củ | Gân & nạm bò 0,08 kg · Xương bò 0,08 kg · Cà chua 0,05 kg · Khoai tây 0,05 kg · Cà rốt 0,04 kg · Hành tây 0,03 kg · Bánh mì baguette 0,25 cái | chỉnh (thêm rau, bánh mì) |

### Bít tết Úc
Mọi steak đã tính **sốt kèm mặc định Tiêu đen 0,05 lít**.

| Mã | Món | Định lượng / 1 phần | Tình trạng |
|---|---|---|---|
| MA006 | Thăn ngoại bò Úc (Striploin) 250g | Thăn ngoại bò Úc 0,27 kg · Khoai tây 0,15 kg · Bơ lạt 0,02 kg · Tỏi 0,005 kg · Dầu ăn 0,01 lít · Sốt tiêu đen 0,05 lít | chỉnh (thêm sốt, tỏi) |
| MA007 | Thăn nội bò Úc (Tenderloin) 200g | Thăn nội bò Úc 0,22 kg · Khoai tây 0,15 kg · Sữa tươi 0,03 lít · Bơ lạt 0,02 kg · Măng tây 0,06 kg · Sốt tiêu đen 0,05 lít | chỉnh (khoai nghiền, măng tây) |
| MA008 | Ribeye bò Úc 300g | Ribeye bò Úc 0,32 kg · Bơ lạt 0,02 kg · Hành tây 0,05 kg · Cà chua 0,05 kg · Khoai tây 0,15 kg · Sốt tiêu đen 0,05 lít | chỉnh |
| MA009 | Ribeye Wagyu Úc MB4+ 200g | Ribeye Wagyu Úc MB4+ 0,21 kg · Ớt xanh (shishito) 0,03 kg · Wasabi 0,003 kg · Sốt ponzu 0,02 lít · Sốt tiêu đen 0,05 lít | chỉnh (bỏ khoai tây) |
| MA010 | T-bone bò Úc 450g | T-bone bò Úc 0,47 kg · Bắp Mỹ 1 quả · Bắp cải 0,06 kg · Giấm 0,005 lít · Đường 0,005 kg · Rau thơm 0,1 bó · Dầu ô liu 0,02 lít · Tỏi 0,005 kg · Sốt tiêu đen 0,05 lít | chỉnh (bắp, salad bắp cải, chimichurri thay khoai) |
| MA011 | Tomahawk bò Úc 1,1kg (2–3 người) | Tomahawk bò Úc 1,15 kg · Tỏi 0,08 kg · Cà rốt 0,15 kg · Bơ lạt 0,03 kg · Rau thơm 0,1 bó · Dầu ô liu 0,02 lít · Sốt tiêu đen 0,1 lít | mới |
| MA012 | Bít tết chảo gang kiểu Việt | Thăn ngoại bò Úc 0,12 kg · Trứng gà 1 quả · Bánh mì baguette 1 cái · Hành tây 0,05 kg · Bơ lạt 0,01 kg · Cà rốt 0,03 kg · Củ cải trắng 0,03 kg · Giấm 0,01 lít · Đường 0,01 kg · Sốt tiêu đen 0,05 lít | chỉnh (bánh mì, đồ chua, sốt) |

### Bò nướng & áp chảo

| Mã | Món | Định lượng / 1 phần | Tình trạng |
|---|---|---|---|
| MA013 | Bò lúc lắc khoai tây | Thăn ngoại bò Úc 0,15 kg · Khoai tây 0,15 kg · Bơ lạt 0,02 kg · Ớt chuông 0,06 kg · Hành tây 0,05 kg · Tỏi 0,005 kg · Dầu ăn 0,05 lít · *Chấm:* Chanh 0,02 kg · Tiêu đen 0,002 kg · Muối 0,002 kg | chỉnh (thêm rau, muối tiêu chanh) |
| MA014 | Sườn bò Úc nướng BBQ | Sườn bò Úc 0,45 kg · Sốt BBQ 0,06 lít · Bắp cải 0,06 kg · Dưa leo 0,03 kg · Giấm 0,005 lít · Đường 0,005 kg | chỉnh (sốt, salad) |
| MA015 | Ba chỉ bò Úc nướng sa tế | Ba chỉ bò Úc 0,2 kg · Sa tế 0,03 kg · Sả 0,02 kg · Tỏi 0,005 kg · Rau thơm 0,3 bó · Rau xà lách 0,05 kg · Bánh tráng 0,3 gói · *Chấm:* Ớt tươi 0,005 kg · Chanh 0,02 kg · Muối 0,003 kg | chỉnh (sa tế, bánh tráng, muối ớt) |
| MA016 | Bò Úc nướng đá nóng | Thăn ngoại bò Úc 0,22 kg · Nấm đùi gà 0,05 kg · Hành tây 0,05 kg · Bơ lạt 0,01 kg · *Chấm:* Chanh 0,02 kg · Tiêu đen 0,002 kg · Muối 0,003 kg | mới |
| MA017 | Lưỡi bò nướng muối ớt | Lưỡi bò 0,25 kg · Sả 0,02 kg · Dưa leo 0,04 kg · Dầu ăn 0,01 lít · *Chấm:* Ớt tươi 0,005 kg · Chanh 0,02 kg · Muối 0,003 kg | chỉnh (thêm sả, muối ớt) |

### Lẩu bò (2–3 người)

| Mã | Món | Định lượng / 1 nồi | Tình trạng |
|---|---|---|---|
| MA018 | Lẩu bò nhúng giấm | Bắp bò 0,5 kg · Giấm 0,05 lít · Thơm 0,25 quả · Sả 0,05 kg · Hành tây 0,1 kg · Cà chua 0,15 kg · Rau thơm 1 bó · Rau xà lách 0,1 kg · Bánh tráng 0,5 gói · Bún tươi 0,3 kg · Dầu ăn 0,01 lít · *Chấm:* Mắm nêm 0,05 lít | chỉnh (nước lẩu, bánh tráng, bún, mắm nêm) |
| MA019 | Lẩu bò Úc sa tế | Ba chỉ bò Úc 0,3 kg · Bắp bò 0,2 kg · Xương bò 0,4 kg · Sa tế 0,05 kg · Sả 0,03 kg · Cà chua 0,1 kg · Nấm đông cô 0,05 kg · Nấm kim châm 0,15 kg · Rau muống 0,2 kg · Bún tươi 0,3 kg · *Chấm:* Chao 0,04 kg | chỉnh |
| MA020 | Lẩu đuôi bò hầm thuốc bắc | Đuôi bò 0,6 kg · Gói thuốc bắc 1 gói · Gừng 0,02 kg · Nấm đông cô 0,05 kg · Cải ngọt 0,3 kg · Khoai môn 0,2 kg · Bún tươi 0,3 kg · *Chấm:* Nước mắm 0,03 chai · Ớt tươi 0,005 kg | chỉnh |
| MA021 | Lẩu shabu Wagyu nước dashi | Ribeye Wagyu Úc MB4+ 0,15 kg · Gói dashi 1 gói · Nấm đông cô 0,05 kg · Nấm kim châm 0,1 kg · Đậu hũ non 0,15 kg · Cải thảo 0,2 kg · *Chấm:* Sốt ponzu 0,04 lít · Nước tương 0,02 lít | chỉnh (Wagyu 0,3 → 0,15 kg cho hợp giá bán) |

### Món nước

| Mã | Món | Định lượng / 1 tô | Tình trạng |
|---|---|---|---|
| MA022 | Phở bò Úc tái nạm | Bánh phở tươi 0,2 kg · Bắp bò 0,07 kg · Gân & nạm bò 0,04 kg · Xương bò 0,1 kg · Gia vị nấu nước dùng 0,005 kg · Gừng 0,005 kg · Hành tây 0,03 kg · Hành lá 0,01 kg · Rau thơm 0,2 bó · Chanh 0,02 kg · Ớt tươi 0,003 kg · Nước mắm 0,01 chai · *Chấm:* Tương đen 0,01 lít · Tương ớt 0,01 lít | chỉnh |
| MA023 | Bún bò Huế | Bún bò Huế 0,2 kg · Bắp bò 0,08 kg · Xương bò 0,1 kg · Sả 0,03 kg · Sa tế 0,01 kg · Hành lá 0,01 kg · Rau thơm 0,2 bó · Chanh 0,02 kg · Nước mắm 0,01 chai | chỉnh |
| MA024 | Hủ tiếu bò kho | Hủ tiếu sợi 0,15 kg · Gân & nạm bò 0,15 kg · Cà chua 0,05 kg · Cà rốt 0,05 kg · Sả 0,02 kg · Gia vị nấu nước dùng 0,005 kg · Hành tây 0,02 kg · Rau thơm 0,1 bó · Chanh 0,02 kg | chỉnh (thêm hủ tiếu, cà rốt) |
| MA025 | Phở Wagyu Úc | Bánh phở tươi 0,2 kg · Ribeye Wagyu Úc MB4+ 0,04 kg · Xương bò 0,1 kg · Gia vị nấu nước dùng 0,005 kg · Gừng 0,005 kg · Hành tây 0,03 kg · Hành lá 0,01 kg · Rau thơm 0,15 bó · Chanh 0,02 kg · *Chấm:* Tương đen 0,01 lít · Tương ớt 0,01 lít | chỉnh |

### Cơm, mì & burger

| Mã | Món | Định lượng / 1 phần | Tình trạng |
|---|---|---|---|
| MA026 | Cơm bò lúc lắc | Thăn ngoại bò Úc 0,1 kg · Gạo ST25 0,15 kg · Cà chua nghiền 0,02 kg · Bơ lạt 0,01 kg · Ớt chuông 0,04 kg · Hành tây 0,03 kg · Dưa leo 0,03 kg · Cà chua 0,04 kg · Hành lá 0,005 kg | chỉnh (cơm đỏ, bỏ trứng) |
| MA027 | Cơm chiên tỏi bò Úc | Gạo ST25 0,2 kg · Thăn ngoại bò Úc 0,07 kg · Trứng gà 1 quả · Tỏi 0,02 kg · Hành lá 0,01 kg · Dầu ăn 0,02 lít · Nước tương 0,01 lít · *Chấm:* Tương ớt 0,01 lít | chỉnh |
| MA028 | Mì Ý bò bằm sốt cà chua | Mì Ý spaghetti 0,12 kg · Thịt bò xay 0,1 kg · Cà chua nghiền 0,08 kg · Cà chua 0,08 kg · Hành tây 0,03 kg · Tỏi 0,005 kg · Dầu ô liu 0,01 lít · Phô mai parmesan 0,01 kg · Rau thơm 0,05 bó | mới |
| MA029 | Burger bò Úc phô mai | Thịt bò xay 0,18 kg · Bánh burger 1 cái · Phô mai cheddar 0,03 kg · Rau xà lách 0,03 kg · Cà chua 0,03 kg · Hành tây 0,08 kg · Dầu ăn 0,05 lít · Tương ớt 0,01 lít | chỉnh (ba chỉ → bò xay, hành chiên vòng thay khoai) |
| MA030 | Mì xào giòn bò | Mì trứng 0,12 kg · Thăn ngoại bò Úc 0,08 kg · Cải ngọt 0,08 kg · Cà rốt 0,03 kg · Hành tây 0,03 kg · Tỏi 0,005 kg · Dầu ăn 0,08 lít · Nước tương 0,015 lít · *Chấm:* Giấm 0,01 lít · Ớt tươi 0,003 kg | mới |

### Gọi thêm (món mới, mã cấp khi thêm vào hệ thống)

| Món | Định lượng / 1 phần | Tình trạng |
|---|---|---|
| Khoai tây nghiền bơ | Khoai tây 0,15 kg · Bơ lạt 0,015 kg · Sữa tươi 0,03 lít · Kem tươi 0,02 lít · Muối 0,002 kg | mới |
| Salad trộn dầu giấm | Rau xà lách 0,06 kg · Cà chua 0,05 kg · Dưa leo 0,04 kg · Hành tây 0,02 kg · Dầu ô liu 0,01 lít · Giấm 0,01 lít | mới |
| Bánh mì bơ tỏi (4 lát) | Bánh mì baguette 0,5 cái · Bơ lạt 0,015 kg · Tỏi 0,005 kg · Rau thơm 0,05 bó | mới |
| Sốt tiêu đen thêm | Sốt tiêu đen pha sẵn 0,05 lít | mới |
| Sốt nấm thêm | Sốt nấm pha sẵn 0,05 lít | mới |
| Sốt vang đỏ thêm | Sốt vang đỏ pha sẵn 0,05 lít | mới |
| Đĩa bò Úc nhúng thêm (150g) | Ba chỉ bò Úc 0,16 kg | mới |
| Đĩa rau nấm thêm | Nấm kim châm 0,1 kg · Nấm đùi gà 0,06 kg · Cải thảo 0,1 kg · Rau muống 0,1 kg · Cải ngọt 0,05 kg | mới |
| Bún tươi thêm | Bún tươi 0,15 kg | mới |

### Tráng miệng

| Mã | Món | Định lượng / 1 phần | Tình trạng |
|---|---|---|---|
| MA031 | Bánh flan caramen | Trứng gà 1 quả · Sữa tươi 0,08 lít · Đường 0,02 kg | chỉnh (thêm sữa, đường) |
| MA032 | Kem vani sốt sô-cô-la | Kem vani 0,12 lít · Sốt sô-cô-la 0,02 lít · Bánh quế cuộn 1 cái | mới |
| MA033 | Chè khúc bạch | Sữa tươi 0,08 lít · Kem tươi 0,04 lít · Bột gelatin 0,003 kg · Đường 0,02 kg · Vải ngâm 0,25 lon · Hạnh nhân lát 0,005 kg | mới |

### Đồ uống

| Mã | Món | Định lượng / 1 phần | Tình trạng |
|---|---|---|---|
| MA034 | Vang đỏ Úc (ly) | Vang đỏ Úc 0,2 chai (1 chai = 5 ly) | giữ |
| mới | Vang đỏ Úc (chai 750ml) | Vang đỏ Úc 1 chai | mới |
| MA035 | Bia thủ công Úc (chai 330ml) | Bia thủ công Úc 1 chai | giữ |
| MA036 | Bia tươi (ly 500ml) | Bia tươi 0,5 lít | mới |
| MA037 | Trà đào cam sả | Trà đen túi lọc 1 túi · Đào ngâm 0,15 lon · Cam tươi 0,05 kg · Sả 0,01 kg · Đường 0,02 kg | mới |
| MA038 | Nước ép cam tươi | Cam tươi 0,4 kg · Đường 0,01 kg | mới |
| mới | Nước suối (chai 500ml) | Nước suối 1 chai | mới |
| mới | Coca-Cola (lon 330ml) | Coca-Cola 1 lon | mới |
| mới | Coca-Cola Zero (lon 330ml) | Coca-Cola Zero 1 lon | mới |
| mới | Sprite (lon 330ml) | Sprite 1 lon | mới |
| mới | Fanta Cam (lon 330ml) | Fanta Cam 1 lon | mới |
| mới | Fanta Nho (lon 330ml) | Fanta Nho 1 lon | mới |
| mới | Sá xị Chương Dương (lon 330ml) | Sá xị Chương Dương 1 lon | mới |

### Món theo mùa

| Mã | Món | Định lượng / 1 phần | Tình trạng |
|---|---|---|---|
| MA039 | Bò Wagyu A5 Nhật (mùa lễ hội) | Bò Wagyu A5 Nhật 0,15 kg · Hành baro 0,05 kg · Wasabi 0,005 kg · Nước tương 0,02 lít | mới |

---

## 3. Tổng kết

- **55 món đang bán + 1 món theo mùa:** tất cả đều có công thức. Không còn món "Chưa có công thức".
  Muốn giữ chỗ để demo màn hình đó thì bỏ trống công thức của MA039 (món theo mùa).
- **Nguyên liệu:** 29 đang có + 77 mới = 106 (Ba chỉ bò Mỹ vẫn "ngừng dùng", không món nào dùng).
- **Cần làm khi áp dụng:**
  - thêm 77 nguyên liệu, liên kết nhà cung cấp và tồn đầu kỳ vào `gen-v7_1.mjs`;
  - cập nhật `RECIPES`;
  - sinh lại SQL (CSDL dev phải xóa để nạp lại);
  - rà test 04;
  - cập nhật `DU_LIEU_GIA.md` (mục công thức mẫu: "27/38 món" → đủ).
- **Kiểm tra giá vốn:** sau khi đưa vào, trang Công thức hiện giá vốn từng món. Rà các món có tỉ lệ giá vốn / giá bán
  cao bất thường (Wagyu, Tomahawk) để chỉnh lượng hoặc giá bán.
