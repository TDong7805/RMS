-- V23 (21/11/2026): siết ngưỡng so khớp khuôn mặt 0,5 → 0,4. Thử thực tế: người khác chấm công được với độ lệch 0,49
-- (sát ngưỡng 0,5), còn đúng người chỉ 0,18–0,24. Chỉ đổi khi quán vẫn để giá trị mặc định cũ.
UPDATE system_settings SET setting_value = '0.4',
       description = 'Độ lệch khuôn mặt tối đa để coi là đúng người (0.3 chặt – 0.6 dễ; khuyên dùng 0.4)'
WHERE setting_key = 'attendance.face_threshold' AND setting_value IN ('0.5', '0.50');
