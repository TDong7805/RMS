/* =====================================================================
   V29_1 — Nội dung mẫu cho trang chủ website kiểu dài một trang (chỉ profile dev).

   Bếp trưởng "Trần Minh Khôi" và lá thư là GIẢ LẬP cho đồ án. Ảnh do SeedImageLoader gắn từ
   backend/database/seed-images/website/ (danh-sach.csv) khi có file ảnh; chưa có ảnh thì website hiện nền tối.
   ===================================================================== */

UPDATE website_content
SET chef_name = 'Trần Minh Khôi',
    chef_title = 'Bếp trưởng',
    chef_letter = 'Thực khách thân mến,\nỞ Royal Beef, triết lý của chúng tôi rất giản dị: chọn phần thịt bò ngon nhất, tôn trọng nó và nướng thật đúng lửa. Mỗi miếng bít tết rời bếp đều đã qua 21 ngày ủ khô và vài phút chăm chút trên than đá núi lửa.\nChúng tôi mong mỗi bữa ăn ở đây là một dịp đáng nhớ, dù bạn đến để mừng sinh nhật, tiếp đối tác hay chỉ để tự thưởng cho mình sau một tuần dài.\nHẹn gặp bạn bên bàn ăn, và cảm ơn bạn đã tin chọn Royal Beef.'
WHERE id = 1;

INSERT INTO website_features (kind, title, subtitle, description, sort_order) VALUES
 ('signature',  'Wagyu A5 sốt vang',       'Bò Nhật Kagoshima',     'Những lát Wagyu A5 vân mỡ dày, áp chảo vừa tới rồi rưới sốt vang đỏ nấu chậm trong ba giờ.', 1),
 ('signature',  'Tomahawk bò Úc',          'Món chia sẻ cho 2–3 người', 'Phần sườn nguyên xương hơn 1 kg, ủ khô 21 ngày, nướng than đá và cắt ngay tại bàn.', 2),
 ('signature',  'Lẩu shabu Wagyu',         'Nước dashi Nhật',       'Nước dùng dashi trong vắt, nhúng từng lát Wagyu mỏng như giấy cùng nấm và rau theo mùa.', 3),
 ('signature',  'Set steak cho 2 người',   'Bữa tối hẹn hò',        'Hai phần ribeye, rau củ nướng, súp kem nấm và hai ly vang đỏ — trọn vẹn cho một buổi tối.', 4),
 ('experience', 'Tiệc sinh nhật',          NULL, 'Trang trí bàn, bánh kem và bài hát mừng từ đội phục vụ. Báo trước để nhà hàng chuẩn bị chu đáo.', 1),
 ('experience', 'Tiếp khách & tiệc công ty', NULL, 'Phòng VIP riêng tối đa 12 khách, thực đơn đặt trước theo ngân sách, xuất hóa đơn công ty.', 2),
 ('experience', 'Bữa tối hẹn hò',          NULL, 'Bàn góc yên tĩnh, ánh nến và set steak cho hai người kèm vang đỏ.', 3),
 ('experience', 'Rượu vang & bò',          NULL, 'Gợi ý vang Úc đi cùng từng phần thịt, từ ribeye đậm vị tới thăn mềm.', 4);
