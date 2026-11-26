# Prompt tạo ảnh AI cho trang chủ website (Royal Beef, E1)

Mỗi ảnh có: **tên file** (đặt đúng tên để mình gắn vào trang), **tỉ lệ**, **dùng ở đâu**, và **prompt** (tiếng Anh, AI vẽ ảnh hiểu tốt hơn).
Ảnh khác hẳn ảnh món đang dùng ở trang QR: góc máy điện ảnh, tối, ánh vàng ấm, như ảnh mẫu E1.

**Lưu ý chung**
- Không để chữ, logo, biển hiệu trong ảnh: AI vẽ chữ tiếng Việt hay bị sai. Tên quán do website tự ghi lên ảnh.
- Ảnh có chừa chỗ trống cho chữ thì prompt đã ghi rõ chừa ở đâu.
- Kích thước gợi ý: ảnh ngang ≥ 2400 px, ảnh dọc ≥ 1600 px. Xuất JPG hoặc WEBP.
- **Đặt ảnh ở đâu:** ảnh lưu ngay trong thư mục này (`backend/database/seed-images/website/`), đúng tên trong
  [danh-sach.csv](danh-sach.csv). Backend chạy chế độ dev tự gắn vào website khi khởi động (như ảnh món).
  Riêng 3 ảnh thẻ **Trước khi đặt bàn** (`luu-y-*`) là ảnh trang trí cố định, đặt ở `frontend/public/images/site/`.
- Không cần tự nén: ảnh tự thu nhỏ còn cạnh dài 2400 px khi gắn. Ghi nguồn ảnh vào [../NGUON_ANH.md](../NGUON_ANH.md).

**Đuôi phong cách** (thêm vào cuối MỌI prompt để các ảnh cùng một tông):

> cinematic editorial photography, warm low-key lighting, deep espresso brown and black tones with amber candlelight highlights, touches of cream and deep wine red, shallow depth of field, subtle film grain, luxurious and calm mood, high detail, no text, no letters, no logo, no signage, no watermark

**Negative prompt** (nếu công cụ có ô này):

> text, letters, words, logo, watermark, signage, menu text, cartoon, oversaturated, harsh flash, plastic food, extra fingers, deformed hands, cluttered background, bright daylight

---

## 1. Phần đầu trang

| File | Tỉ lệ | Dùng ở |
|---|---|---|
| `hero.jpg` | 16:9 (ngang rộng) | Ảnh nền phần đầu trang, tên **Royal Beef** chữ cực lớn đè lên nửa trên |

> Wide interior shot of an upscale steakhouse dining room at night, dark walnut wood panels, leather banquettes, small brass table lamps glowing on white tablecloths with wine glasses and steak knives, a glimpse of an open charcoal grill with soft orange glow in the far background, the upper half of the frame is dark and empty (deep shadow on the ceiling) to leave room for a large title, camera at table height, symmetrical composition

## 2. Món đặc trưng (ảnh lớn tự trượt)

| File | Tỉ lệ | Dùng ở |
|---|---|---|
| `dac-trung-1-wagyu.jpg` | 16:9 | Wagyu A5 rưới sốt |
| `dac-trung-2-tomahawk.jpg` | 16:9 | Tomahawk bò Úc |
| `dac-trung-3-lau.jpg` | 16:9 | Lẩu shabu Wagyu nước dashi |
| `dac-trung-4-set-2-nguoi.jpg` | 16:9 | Set steak cho 2 người |

Mỗi ảnh chừa khoảng tối ở **giữa phía trên** để ghi tên món chữ lớn.

> **1:** Close-up of a hand pouring glossy dark red wine reduction sauce from a small copper saucepan onto sliced medium-rare Japanese A5 wagyu with intense marbling, plated on a wide matte white ceramic bowl with a few microgreens, sauce in mid-air stream, dark background, the top center area is dark and empty for a title

> **2:** A whole grilled tomahawk ribeye steak with a long bone, sliced medium-rare on a dark wooden carving board, coarse sea salt and rosemary, small cast-iron pot of butter, faint flame and smoke from a charcoal grill behind, side angle at table level, the top center area is dark and empty for a title

> **3:** Japanese shabu-shabu hotpot with clear golden dashi broth steaming in a black cast-iron pot, chopsticks lifting a paper-thin slice of marbled wagyu beef, plate of fanned raw wagyu slices, mushrooms and greens beside it, rising steam lit by warm side light, the top center area is dark and empty for a title

> **4:** Romantic table for two in a dark steakhouse: two plates of sliced ribeye steak with roasted vegetables, two glasses of red wine, a small candle between them, linen napkins, view from slightly above, the top center area is dark and empty for a title

## 3. Trước khi đặt bàn (3 thẻ)

Theo ảnh mẫu: thẻ đầu là ảnh chụp, hai thẻ sau là hình vẽ nét trắng trên nền đen.

| File | Tỉ lệ | Dùng ở |
|---|---|---|
| `luu-y-1-gio-phuc-vu.jpg` | 3:4 (dọc) | Thẻ "Giờ phục vụ" |
| `luu-y-2-dat-ban.png` | 1:1 | Thẻ "Quy định đặt bàn" (hình vẽ nét) |
| `luu-y-3-phong-rieng.png` | 1:1 | Thẻ "Phòng riêng / khu vực" (hình vẽ nét) |

> **1 (ảnh chụp):** Top-down shot of a plated beef tenderloin steak with red wine jus and a small portion of truffle mashed potato on a dark stoneware plate, steak knife and fork beside, dark slate table surface, moody light from one side

> **2 (hình vẽ):** Minimal hand-drawn line illustration in thin white ink on a pure black background: an open reservation book with a fountain pen and a small pocket watch beside it, elegant engraving style, centered, lots of empty space, no shading, no text
> *(không thêm đuôi phong cách cho ảnh này)*

> **3 (hình vẽ):** Minimal hand-drawn line illustration in thin white ink on a pure black background: a round dining table set for a private dinner with chairs around it and a pendant lamp above, elegant engraving style, centered, lots of empty space, no shading, no text
> *(không thêm đuôi phong cách cho ảnh này)*

## 4. Trải nghiệm (danh sách bên trái, ảnh bên phải đổi theo dòng)

Set menu lấy ảnh set có sẵn, nên chỉ cần ảnh cho các trải nghiệm còn lại.

| File | Tỉ lệ | Dùng ở |
|---|---|---|
| `trai-nghiem-1-sinh-nhat.jpg` | 4:5 (dọc) | Tiệc sinh nhật |
| `trai-nghiem-2-tiep-khach.jpg` | 4:5 | Tiếp khách / tiệc công ty |
| `trai-nghiem-3-hen-ho.jpg` | 4:5 | Bữa tối hẹn hò |
| `trai-nghiem-4-ruou-vang.jpg` | 4:5 | Rượu vang đi kèm bò |

> **1:** A small group of Vietnamese friends celebrating a birthday at a steakhouse table at night, a waiter bringing a small dessert with a single sparkler candle, warm smiles, steaks and wine glasses on the table, candid moment, faces softly lit, not looking at camera

> **2:** Business dinner in a private dining room: four Vietnamese professionals in smart casual clothes around a long dark wood table with sliced steak platters and red wine, one person raising a glass for a toast, warm pendant lights, candid, not looking at camera

> **3:** A Vietnamese couple at a candlelit corner table in an elegant steakhouse, clinking red wine glasses over two plates of steak, soft bokeh lights behind, intimate and romantic, seen from a slight distance, not looking at camera

> **4:** A sommelier's hand pouring red wine into a large glass next to a sliced dry-aged ribeye on a wooden board, wine bottles softly blurred in a lit wine cabinet behind, close-up

## 5. Không gian (ảnh trượt + số liệu tầng, bàn, chỗ)

Khớp các khu trong dữ liệu mẫu: Tầng 1 (sảnh chính), Sân vườn, Tầng 2 (gia đình), Phòng VIP (tối đa 12 khách).

| File | Tỉ lệ | Dùng ở |
|---|---|---|
| `khong-gian-1-sanh-chinh.jpg` | 16:9 | Tầng 1, sảnh chính |
| `khong-gian-2-tang-2.jpg` | 16:9 | Tầng 2, yên tĩnh, gia đình |
| `khong-gian-3-vip.jpg` | 16:9 | Phòng VIP |
| `khong-gian-4-san-vuon.jpg` | 16:9 | Sân vườn |
| `khong-gian-5-tu-u-thit.jpg` | 16:9 | Tủ ủ thịt khô và bếp than |

Mỗi ảnh chừa vùng tối ở **giữa** để đặt số liệu.

> **1:** Main dining hall of a luxury steakhouse on the ground floor, rows of tables with white linen and brass lamps, dark wood and leather, a cashier counter in warm light at the side, a large pendant lamp in the foreground, empty restaurant before service, wide angle, darker area in the middle of the frame

> **2:** Quiet second-floor dining room for families, round tables with comfortable upholstered chairs, large windows with sheer curtains showing city lights at night, warm wooden floor, soft warm lighting, empty before service, wide angle

> **3:** Private VIP dining room with one long dark wood table set for twelve guests, high-back velvet chairs in deep wine red, a crystal chandelier dimmed low, wine glasses and folded napkins, closed wooden doors, wide angle

> **4:** Covered garden terrace of a steakhouse at night, wooden tables among tropical plants and climbing greenery, string lights and lanterns overhead, a retractable canvas roof, warm cozy glow, empty before service, wide angle

> **5:** A glass-front dry-aging cabinet with large cuts of beef hanging and lit by soft amber light, next to an open charcoal grill with glowing embers in a dark professional kitchen, side view

## 6. Về chúng tôi

| File | Tỉ lệ | Dùng ở |
|---|---|---|
| `ve-chung-toi-bep.jpg` | 4:5 (dọc) | Nửa ảnh cạnh đoạn giới thiệu |

> A chef in a dark apron grilling thick steaks over a charcoal grill in an open kitchen, flames and sparks rising, pendant lamps above the pass, the chef seen from the side and focused on the work, face partly in shadow

## 7. Lời từ bếp trưởng

| File | Tỉ lệ | Dùng ở |
|---|---|---|
| `bep-truong.jpg` | 3:4 (dọc) | Ảnh chân dung cạnh lá thư |

> Portrait of a confident Vietnamese head chef in his 40s wearing a crisp white double-breasted chef jacket, arms crossed, gentle smile, standing in a dimly lit steakhouse kitchen with warm bokeh lights behind, waist-up, eye-level

## 8. Form đặt bàn

| File | Tỉ lệ | Dùng ở |
|---|---|---|
| `dat-ban.jpg` | 4:5 (dọc) | Nửa ảnh cạnh form đặt bàn |

> Close-up of a waiter's hands in white gloves carrying two plates of beautifully plated sliced steak with sauce through a dark restaurant, motion slightly blurred in the background, warm light on the plates
