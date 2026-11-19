/* =====================================================================
   DỮ LIỆU MẪU — Quản lý món ăn (chỉ profile dev, KHÔNG dùng cho môi trường thật)

   Nhà hàng Royal Beef: bò Úc hiện đại kèm món Việt.
   - 55 món đang bán chia 9 danh mục (8 danh mục ở V1_1 + "Gọi thêm" ở đây, đặt cuối thực đơn): Khai vị, Bít tết Úc,
     Bò nướng & áp chảo, Lẩu bò, Món nước, Cơm, mì & burger, Tráng miệng, Đồ uống, Gọi thêm (món ăn kèm / gọi thêm cho
     steak, lẩu: khoai nghiền, salad, bánh mì bơ tỏi, sốt, bò nhúng, rau nấm, bún).
   - Nhóm món và set menu ở V19_1 (cần bảng của migration V19).
   - Danh mục "Món theo mùa" đang tắt + 1 món đang ngừng bán (thử quy tắc: không chọn được danh mục đã tắt,
     khách không thấy món ngừng bán).
   - Ảnh món: không có trong file này — đặt ảnh ở backend/database/seed-images/mon/ (xem README ở đó),
     backend chạy profile dev tự gắn ảnh cho món.
   - 8 đơn hàng đã hoàn tất trong 7 ngày qua: mô phỏng dữ liệu Khách hàng / Thu ngân sẽ tạo,
     để thấy quy tắc "món đã có trong đơn hàng thì không xóa được, chỉ chuyển Ngừng bán".
   ===================================================================== */

SET NAMES utf8mb4;
SET time_zone = '+07:00';

/* ---------------------------------------------------------------- Danh mục */
INSERT INTO dish_categories (name, is_active, sort_order) VALUES ('Gọi thêm', 1, 9), ('Món theo mùa', 0, 10);

/* ---------------------------------------------------------------- Món ăn */
-- days = số ngày trước món được tạo; h = số giờ trước món được cập nhật lần cuối.
INSERT INTO dishes (code, name, category_id, price, description, ingredients_text, spicy_level, status, ai_enabled,
                    created_at, updated_at, status_updated_at)
SELECT x.code, x.name, c.id, x.price, NULLIF(x.descr, ''), NULLIF(x.ing, ''), x.spicy, x.status, x.status = 'selling',
       NOW() - INTERVAL x.days DAY, NOW() - INTERVAL x.h HOUR, NOW() - INTERVAL x.h HOUR
FROM (
  -- Khai vị
  SELECT 'MA001' code, 'Bò cuốn lá lốt nướng' name, 'Khai vị' cat, 89000 price, 'Bò Úc băm cuốn lá lốt nướng than, chấm mắm nêm.' descr, 'Bò Úc xay, lá lốt, sả, đậu phộng rang, rau sống, bún' ing, 0 spicy, 'selling' status, 200 days, 30 h UNION ALL
  SELECT 'MA002', 'Gỏi bò tái chanh', 'Khai vị', 95000, 'Bắp bò tái chanh, rau răm, hành tây giòn. Bò tái — không phù hợp phụ nữ mang thai, trẻ nhỏ.', 'Bắp bò, chanh, hành tây, rau răm, ớt, đậu phộng rang', 1, 'selling', 198, 52 UNION ALL
  SELECT 'MA003', 'Bò Úc tataki sốt ponzu', 'Khai vị', 145000, 'Thăn bò Úc áp chảo tái, thái mỏng, sốt ponzu chua nhẹ. Bò tái — không phù hợp phụ nữ mang thai, trẻ nhỏ.', 'Thăn ngoại bò Úc, sốt ponzu, mè rang, hành lá, củ cải', 0, 'selling', 120, 75 UNION ALL
  SELECT 'MA004', 'Khoai tây chiên phô mai bò băm', 'Khai vị', 85000, 'Khoai chiên giòn phủ bò băm sốt và phô mai cheddar.', 'Khoai tây, bò băm, phô mai cheddar, hành phi', 0, 'selling', 150, 98 UNION ALL
  SELECT 'MA005', 'Súp bò hầm rau củ', 'Khai vị', 69000, 'Súp nóng hầm nhừ, ấm bụng mở đầu bữa ăn.', 'Gân bò, nạm bò, cà rốt, khoai tây, cà chua, cần tây', 0, 'selling', 190, 121 UNION ALL
  -- Bít tết Úc
  SELECT 'MA006', 'Thăn ngoại bò Úc (Striploin) 250g', 'Bít tết Úc', 395000, 'Thớ thịt chắc, viền mỡ thơm. Kèm khoai bi nướng; chọn sốt tiêu đen / nấm / vang đỏ.', 'Thăn ngoại bò Úc 250g, khoai tây bi, bơ tỏi', 0, 'selling', 210, 26 UNION ALL
  SELECT 'MA007', 'Thăn nội bò Úc (Tenderloin) 200g', 'Bít tết Úc', 465000, 'Phần mềm nhất của con bò, ít mỡ. Kèm khoai nghiền, rau củ nướng.', 'Thăn nội bò Úc 200g, khoai tây nghiền, măng tây, bơ tỏi', 0, 'selling', 210, 47 UNION ALL
  SELECT 'MA008', 'Ribeye bò Úc 300g', 'Bít tết Úc', 525000, 'Vân mỡ đều, mọng nước — lựa chọn của tín đồ bít tết.', 'Ribeye bò Úc 300g, khoai tây nghiền, rau củ nướng, bơ tỏi', 0, 'selling', 210, 12 UNION ALL
  SELECT 'MA009', 'Ribeye Wagyu Úc MB4+ 200g', 'Bít tết Úc', 890000, 'Bò Wagyu Úc vân mỡ MB4+, tan trong miệng. Khuyên dùng chín tái.', 'Ribeye Wagyu Úc MB4+ 200g, muối hồng Himalaya, măng tây, khoai tây nghiền', 0, 'selling', 140, 64 UNION ALL
  SELECT 'MA010', 'T-bone bò Úc 450g', 'Bít tết Úc', 650000, 'Hai phần thịt trên một khúc xương: thăn ngoại và thăn nội.', 'T-bone bò Úc 450g, khoai tây nướng, rau củ nướng', 0, 'selling', 180, 90 UNION ALL
  SELECT 'MA011', 'Tomahawk bò Úc 1,1kg (2–3 người)', 'Bít tết Úc', 1590000, 'Ribeye nguyên xương dài, nướng than và thái tại bàn. Phần cho 2–3 người.', 'Tomahawk bò Úc 1,1kg, khoai tây nghiền, rau củ nướng, 2 loại sốt', 0, 'selling', 95, 140 UNION ALL
  SELECT 'MA012', 'Bít tết chảo gang kiểu Việt', 'Bít tết Úc', 169000, 'Bò Úc trên chảo gang nóng, trứng ốp la, pa-tê, bánh mì giòn.', 'Thăn ngoại bò Úc, trứng gà, pa-tê, bánh mì, sốt bò', 0, 'selling', 205, 33 UNION ALL
  -- Bò nướng & áp chảo
  SELECT 'MA013', 'Bò lúc lắc khoai tây', 'Bò nướng & áp chảo', 179000, 'Bò Úc cắt hạt lựu xào lửa lớn, sốt tiêu đen, khoai tây chiên.', 'Thăn ngoại bò Úc, khoai tây chiên, ớt chuông, hành tây, bơ, tiêu đen', 0, 'selling', 200, 18 UNION ALL
  SELECT 'MA014', 'Sườn bò Úc nướng BBQ', 'Bò nướng & áp chảo', 345000, 'Sườn bò (short ribs) ướp sốt BBQ, nướng chậm, mềm rời xương.', 'Sườn bò Úc, sốt BBQ, mật ong, tỏi, salad bắp cải', 0, 'selling', 170, 110 UNION ALL
  SELECT 'MA015', 'Ba chỉ bò Úc nướng sa tế', 'Bò nướng & áp chảo', 159000, 'Ba chỉ bò Úc thái mỏng ướp sa tế, nướng tại bàn.', 'Ba chỉ bò Úc, sa tế, sả, tỏi, rau sống, bánh tráng', 2, 'selling', 165, 85 UNION ALL
  SELECT 'MA016', 'Bò Úc nướng đá nóng', 'Bò nướng & áp chảo', 285000, 'Thăn bò Úc thái lát, tự nướng trên đá núi lửa nóng tại bàn.', 'Thăn ngoại bò Úc, đá nướng, muối tiêu chanh, rau củ', 0, 'selling', 130, 160 UNION ALL
  SELECT 'MA017', 'Lưỡi bò nướng muối ớt', 'Bò nướng & áp chảo', 189000, 'Lưỡi bò giòn sần sật, nướng muối ớt thơm nồng.', 'Lưỡi bò, muối hột, ớt hiểm, sả, lá chanh', 2, 'selling', 125, 175 UNION ALL
  -- Lẩu bò
  SELECT 'MA018', 'Lẩu bò nhúng giấm', 'Lẩu bò', 395000, 'Phần cho 2–3 người. Nước lẩu giấm chua thanh, cuốn bánh tráng rau sống.', 'Bắp bò, thăn bò Úc, giấm dừa, sả, hành tây, bánh tráng, rau sống, bún', 0, 'selling', 200, 40 UNION ALL
  SELECT 'MA019', 'Lẩu bò Úc sa tế', 'Lẩu bò', 445000, 'Phần cho 2–3 người. Nước lẩu sa tế cay nồng, nhúng ba chỉ và bắp bò Úc.', 'Ba chỉ bò Úc, bắp bò, sa tế, nấm, rau muống, cải, mì', 3, 'selling', 185, 70 UNION ALL
  SELECT 'MA020', 'Lẩu đuôi bò hầm thuốc bắc', 'Lẩu bò', 425000, 'Phần cho 2–3 người. Đuôi bò hầm mềm với táo đỏ, kỷ tử.', 'Đuôi bò, táo đỏ, kỷ tử, nấm đông cô, củ năng, rau cải', 0, 'selling', 160, 130 UNION ALL
  SELECT 'MA021', 'Lẩu shabu Wagyu nước dashi', 'Lẩu bò', 690000, 'Phần cho 2–3 người. Wagyu Úc thái mỏng nhúng nước dashi kiểu Nhật.', 'Wagyu Úc thái mỏng, nước dashi (cá bào, rong biển), nấm, đậu hũ, rau', 0, 'selling', 90, 55 UNION ALL
  -- Món nước
  SELECT 'MA022', 'Phở bò Úc tái nạm', 'Món nước', 85000, 'Nước dùng xương hầm 12 tiếng, bò Úc tái và nạm.', 'Bánh phở, thăn bò Úc, nạm bò, xương bò, hành, quế hồi', 0, 'selling', 210, 8 UNION ALL
  SELECT 'MA023', 'Bún bò Huế', 'Món nước', 79000, 'Đậm vị mắm ruốc, sả, sa tế đúng kiểu Huế.', 'Bún sợi to, bắp bò, giò heo, chả cua, mắm ruốc, sả, sa tế', 2, 'selling', 205, 60 UNION ALL
  SELECT 'MA024', 'Hủ tiếu bò kho', 'Món nước', 79000, 'Bò kho mềm thơm quế hồi, ăn kèm hủ tiếu hoặc bánh mì.', 'Gân bò, nạm bò, cà rốt, sả, quế hồi, hủ tiếu', 1, 'selling', 180, 100 UNION ALL
  SELECT 'MA025', 'Phở Wagyu Úc', 'Món nước', 165000, 'Phở đặc biệt với Wagyu Úc thái mỏng, chần tái tại bàn.', 'Bánh phở, Wagyu Úc, xương bò, hành, quế hồi', 0, 'selling', 100, 80 UNION ALL
  -- Cơm, mì & burger
  SELECT 'MA026', 'Cơm bò lúc lắc', 'Cơm, mì & burger', 115000, 'Bò lúc lắc ăn cùng cơm đỏ ST25, dưa leo, cà chua.', 'Thăn ngoại bò Úc, cơm ST25, ớt chuông, hành tây, cà chua, dưa leo', 0, 'selling', 195, 22 UNION ALL
  SELECT 'MA027', 'Cơm chiên tỏi bò Úc', 'Cơm, mì & burger', 99000, 'Cơm chiên tỏi giòn thơm, bò Úc xào lửa lớn.', 'Cơm ST25, thăn bò Úc, tỏi, trứng gà, hành lá', 0, 'selling', 175, 115 UNION ALL
  SELECT 'MA028', 'Mì Ý bò bằm sốt cà chua', 'Cơm, mì & burger', 125000, 'Spaghetti sốt bò bằm Bolognese, phô mai parmesan.', 'Mì Ý, bò băm, cà chua, hành tây, phô mai parmesan', 0, 'selling', 150, 150 UNION ALL
  SELECT 'MA029', 'Burger bò Úc phô mai', 'Cơm, mì & burger', 145000, 'Patty bò Úc 180g, phô mai cheddar, hành tây chiên vòng.', 'Bánh burger mè, bò Úc xay, phô mai cheddar, xà lách, cà chua, hành tây', 0, 'selling', 140, 45 UNION ALL
  SELECT 'MA030', 'Mì xào giòn bò', 'Cơm, mì & burger', 109000, 'Mì chiên giòn rưới sốt bò xào rau cải.', 'Mì trứng chiên giòn, thăn bò, cải ngọt, cà rốt, nấm', 0, 'selling', 160, 190 UNION ALL
  -- Tráng miệng
  SELECT 'MA031', 'Bánh flan caramen', 'Tráng miệng', 39000, 'Mềm mịn, caramen đắng nhẹ.', 'Trứng, sữa tươi, caramen', 0, 'selling', 200, 210 UNION ALL
  SELECT 'MA032', 'Kem vani sốt sô-cô-la', 'Tráng miệng', 49000, 'Kem vani rưới sốt sô-cô-la nóng.', 'Kem vani, sô-cô-la đen, bánh quế', 0, 'selling', 150, 230 UNION ALL
  SELECT 'MA033', 'Chè khúc bạch', 'Tráng miệng', 45000, 'Thạch sữa hạnh nhân, vải, nhãn mát lạnh.', 'Sữa tươi, gelatin, hạnh nhân lát, vải, nhãn', 0, 'selling', 120, 250 UNION ALL
  -- Đồ uống
  SELECT 'MA034', 'Vang đỏ Úc (ly)', 'Đồ uống', 145000, 'Shiraz vùng Barossa, hợp với bít tết.', 'Vang đỏ Shiraz Úc, ly 150ml', 0, 'selling', 200, 270 UNION ALL
  SELECT 'MA035', 'Bia thủ công Úc (chai 330ml)', 'Đồ uống', 79000, 'Pale ale thủ công nhập khẩu từ Úc.', 'Bia chai 330ml', 0, 'selling', 180, 290 UNION ALL
  SELECT 'MA036', 'Bia tươi (ly 500ml)', 'Đồ uống', 45000, '', 'Bia tươi ly 500ml', 0, 'selling', 200, 310 UNION ALL
  SELECT 'MA037', 'Trà đào cam sả', 'Đồ uống', 55000, 'Trà đen, đào miếng, cam tươi, sả.', 'Trà đen, đào ngâm, cam, sả', 0, 'selling', 190, 330 UNION ALL
  SELECT 'MA038', 'Nước ép cam tươi', 'Đồ uống', 49000, '', 'Cam sành tươi', 0, 'selling', 190, 350 UNION ALL
  SELECT 'MA040', 'Vang đỏ Úc (chai 750ml)', 'Đồ uống', 890000, 'Shiraz vùng Barossa, chai 750ml cho cả bàn.', 'Vang đỏ Shiraz Úc, chai 750ml', 0, 'selling', 90, 20 UNION ALL
  SELECT 'MA041', 'Nước suối (chai 500ml)', 'Đồ uống', 25000, '', 'Nước khoáng đóng chai 500ml', 0, 'selling', 90, 22 UNION ALL
  SELECT 'MA042', 'Coca-Cola (lon 330ml)', 'Đồ uống', 35000, '', 'Nước ngọt có ga, lon 330ml', 0, 'selling', 90, 24 UNION ALL
  SELECT 'MA043', 'Coca-Cola Zero (lon 330ml)', 'Đồ uống', 35000, 'Không đường.', 'Nước ngọt có ga không đường, lon 330ml', 0, 'selling', 90, 26 UNION ALL
  SELECT 'MA044', 'Sprite (lon 330ml)', 'Đồ uống', 35000, 'Vị chanh.', 'Nước ngọt có ga vị chanh, lon 330ml', 0, 'selling', 90, 28 UNION ALL
  SELECT 'MA045', 'Fanta Cam (lon 330ml)', 'Đồ uống', 35000, '', 'Nước ngọt có ga vị cam, lon 330ml', 0, 'selling', 90, 30 UNION ALL
  SELECT 'MA046', 'Fanta Nho (lon 330ml)', 'Đồ uống', 35000, '', 'Nước ngọt có ga vị nho, lon 330ml', 0, 'selling', 90, 32 UNION ALL
  SELECT 'MA047', 'Sá xị Chương Dương (lon 330ml)', 'Đồ uống', 35000, 'Nước giải khát Việt Nam từ 1952.', 'Nước ngọt có ga vị xá xị, lon 330ml', 0, 'selling', 90, 34 UNION ALL
  -- Gọi thêm
  SELECT 'MA048', 'Khoai tây nghiền bơ', 'Gọi thêm', 45000, 'Ăn kèm bít tết.', 'Khoai tây, bơ, sữa tươi, kem tươi', 0, 'selling', 90, 36 UNION ALL
  SELECT 'MA049', 'Salad trộn dầu giấm', 'Gọi thêm', 49000, 'Rau xanh, cà chua bi, dưa leo, sốt dầu giấm.', 'Xà lách, cà chua, dưa leo, hành tây, dầu ô liu, giấm', 0, 'selling', 90, 38 UNION ALL
  SELECT 'MA050', 'Bánh mì bơ tỏi (4 lát)', 'Gọi thêm', 35000, 'Ăn kèm bít tết, súp, bò kho.', 'Bánh mì baguette, bơ, tỏi, rau mùi tây', 0, 'selling', 90, 40 UNION ALL
  SELECT 'MA051', 'Sốt tiêu đen thêm', 'Gọi thêm', 25000, 'Thêm một chén sốt cho bít tết.', 'Sốt tiêu đen', 1, 'selling', 90, 42 UNION ALL
  SELECT 'MA052', 'Sốt nấm thêm', 'Gọi thêm', 25000, 'Thêm một chén sốt cho bít tết.', 'Sốt kem nấm', 0, 'selling', 90, 44 UNION ALL
  SELECT 'MA053', 'Sốt vang đỏ thêm', 'Gọi thêm', 25000, 'Thêm một chén sốt cho bít tết.', 'Sốt vang đỏ', 0, 'selling', 90, 46 UNION ALL
  SELECT 'MA054', 'Đĩa bò Úc nhúng thêm (150g)', 'Gọi thêm', 129000, 'Gọi thêm khi ăn lẩu.', 'Ba chỉ bò Úc thái mỏng 150g', 0, 'selling', 90, 48 UNION ALL
  SELECT 'MA055', 'Đĩa rau nấm thêm', 'Gọi thêm', 59000, 'Gọi thêm khi ăn lẩu.', 'Nấm kim châm, nấm đùi gà, cải thảo, rau muống, cải ngọt', 0, 'selling', 90, 50 UNION ALL
  SELECT 'MA056', 'Bún tươi thêm', 'Gọi thêm', 15000, 'Gọi thêm khi ăn lẩu, bún bò.', 'Bún tươi', 0, 'selling', 90, 52 UNION ALL
  -- Món theo mùa (danh mục đang tắt, món đang ngừng bán)
  SELECT 'MA039', 'Bò Wagyu A5 Nhật (mùa lễ hội)', 'Món theo mùa', 1890000, 'Chỉ phục vụ dịp Giáng sinh – Tết.', 'Thăn Wagyu A5 Kagoshima 150g, muối hồng, wasabi tươi', 0, 'stopped', 300, 900
) x JOIN dish_categories c ON c.name = x.cat;

INSERT INTO dish_allergens (dish_id, allergen_id)
SELECT d.id, a.id FROM dishes d JOIN allergens a ON
     (d.code = 'MA001' AND a.name IN ('Đậu phộng'))
  OR (d.code = 'MA002' AND a.name IN ('Đậu phộng'))
  OR (d.code = 'MA003' AND a.name IN ('Mè (vừng)','Đậu nành'))
  OR (d.code = 'MA004' AND a.name IN ('Sữa'))
  OR (d.code = 'MA012' AND a.name IN ('Trứng','Gluten (lúa mì)'))
  OR (d.code = 'MA021' AND a.name IN ('Đậu nành','Cá'))
  OR (d.code = 'MA023' AND a.name IN ('Hải sản có vỏ'))
  OR (d.code = 'MA027' AND a.name IN ('Trứng'))
  OR (d.code = 'MA028' AND a.name IN ('Gluten (lúa mì)','Sữa'))
  OR (d.code = 'MA029' AND a.name IN ('Gluten (lúa mì)','Sữa','Mè (vừng)'))
  OR (d.code = 'MA030' AND a.name IN ('Gluten (lúa mì)','Trứng'))
  OR (d.code = 'MA031' AND a.name IN ('Trứng','Sữa'))
  OR (d.code = 'MA032' AND a.name IN ('Sữa','Gluten (lúa mì)'))
  OR (d.code = 'MA033' AND a.name IN ('Sữa','Hạt cây'))
  OR (d.code = 'MA035' AND a.name IN ('Gluten (lúa mì)'))
  OR (d.code = 'MA036' AND a.name IN ('Gluten (lúa mì)'))
  OR (d.code = 'MA048' AND a.name IN ('Sữa'))
  OR (d.code = 'MA050' AND a.name IN ('Gluten (lúa mì)','Sữa'))
  OR (d.code = 'MA052' AND a.name IN ('Sữa'));

INSERT INTO dish_ai_tags (dish_id, tag_id)
SELECT d.id, t.id FROM dishes d JOIN ai_tags t ON
     (d.code IN ('MA006','MA008','MA013','MA018','MA022') AND t.name = 'Bán chạy')
  OR (d.code IN ('MA001','MA018','MA022','MA023','MA024') AND t.name = 'Món Việt truyền thống')
  OR (d.code IN ('MA011','MA018','MA019','MA020','MA021') AND t.name = 'Nhóm 4 người')
  OR (d.code IN ('MA015','MA017','MA019','MA023') AND t.name = 'Cay')
  OR (d.code IN ('MA004','MA029','MA031','MA032','MA045') AND t.name = 'Trẻ em thích')
  OR (d.code IN ('MA002','MA003','MA005','MA033') AND t.name = 'Món nhẹ')
  OR (d.code IN ('MA003','MA007','MA021') AND t.name = 'Ít dầu mỡ')
  OR (d.code IN ('MA006','MA007','MA012','MA022') AND t.name = 'Ít cay')
  OR (d.code = 'MA039' AND t.name = 'Theo mùa');

/* ---------------------------------------------------------------- Đơn hàng đã hoàn tất (mô phỏng) */
-- d = số ngày trước, t = giờ vào bàn. Đơn do khách gọi qua QR (created_by NULL).
INSERT INTO orders (code, table_id, status, source, created_at, closed_at)
SELECT o.code, t.id, 'completed', 'qr',
       TIMESTAMP(CURRENT_DATE - INTERVAL o.d DAY, o.t),
       TIMESTAMP(CURRENT_DATE - INTERVAL o.d DAY, o.t) + INTERVAL 75 MINUTE
FROM (
  SELECT 'DH-0001' code, 7 d, '11:40' t, 'T03' tbl UNION ALL
  SELECT 'DH-0002', 6, '18:20', 'VIP01' UNION ALL
  SELECT 'DH-0003', 5, '12:10', 'T01' UNION ALL
  SELECT 'DH-0004', 5, '19:05', 'SV02' UNION ALL
  SELECT 'DH-0005', 4, '18:45', 'T06' UNION ALL
  SELECT 'DH-0006', 3, '11:55', 'L2-01' UNION ALL
  SELECT 'DH-0007', 2, '19:30', 'VIP02' UNION ALL
  SELECT 'DH-0008', 1, '12:25', 'T02'
) o JOIN dining_tables t ON t.code = o.tbl;

-- Giá trong đơn là bản chụp lúc bán: đổi giá món sau này không làm đổi các đơn này.
INSERT INTO order_items (order_id, dish_id, dish_name, unit_price, quantity, status, added_via, created_at, completed_at, served_at)
SELECT o.id, d.id, d.name, d.price, i.qty, 'served', 'customer', o.created_at,
       o.created_at + INTERVAL 20 MINUTE, o.created_at + INTERVAL 25 MINUTE
FROM (
  SELECT 'DH-0001' oc, 'MA022' dc, 2 qty UNION ALL SELECT 'DH-0001', 'MA026', 1 UNION ALL SELECT 'DH-0001', 'MA037', 3 UNION ALL
  SELECT 'DH-0002', 'MA011', 1 UNION ALL SELECT 'DH-0002', 'MA003', 2 UNION ALL SELECT 'DH-0002', 'MA034', 4 UNION ALL
  SELECT 'DH-0002', 'MA039', 1 UNION ALL SELECT 'DH-0002', 'MA032', 4 UNION ALL
  SELECT 'DH-0003', 'MA023', 1 UNION ALL SELECT 'DH-0003', 'MA027', 1 UNION ALL SELECT 'DH-0003', 'MA038', 2 UNION ALL
  SELECT 'DH-0004', 'MA019', 1 UNION ALL SELECT 'DH-0004', 'MA015', 1 UNION ALL SELECT 'DH-0004', 'MA036', 4 UNION ALL
  SELECT 'DH-0005', 'MA018', 1 UNION ALL SELECT 'DH-0005', 'MA001', 1 UNION ALL SELECT 'DH-0005', 'MA013', 1 UNION ALL
  SELECT 'DH-0005', 'MA031', 3 UNION ALL
  SELECT 'DH-0006', 'MA029', 2 UNION ALL SELECT 'DH-0006', 'MA004', 1 UNION ALL SELECT 'DH-0006', 'MA037', 2 UNION ALL
  SELECT 'DH-0007', 'MA008', 2 UNION ALL SELECT 'DH-0007', 'MA006', 2 UNION ALL SELECT 'DH-0007', 'MA002', 2 UNION ALL
  SELECT 'DH-0007', 'MA035', 4 UNION ALL
  SELECT 'DH-0008', 'MA012', 1 UNION ALL SELECT 'DH-0008', 'MA022', 1 UNION ALL SELECT 'DH-0008', 'MA038', 1
) i
JOIN orders o ON o.code = i.oc
JOIN dishes d ON d.code = i.dc;
