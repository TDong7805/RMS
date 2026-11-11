import { createRoot } from 'react-dom/client';
import App from './App';
// Font đóng gói cùng ứng dụng (có bộ chữ tiếng Việt) thay vì tải từ Google Fonts lúc chạy:
// tránh chờ mạng và tránh chữ có dấu bị hiển thị lẫn font tạm trong lúc tải.
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/jetbrains-mono';
import './styles/globals.css';

// Vẽ giao diện ngay. Trước đây phải chờ gọi GET /api/config (mẫu của công cụ sinh code) xong
// mới render, trong khi backend không có API đó và địa chỉ API đã lấy từ VITE_API_BASE_URL (lib/http.ts).
createRoot(document.getElementById('root')!).render(<App />);
