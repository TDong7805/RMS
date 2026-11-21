import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { SiteEmpty } from '@/features/public-site/parts';

/** Đường dẫn không tồn tại (kể cả gõ nhầm) → trang thông báo trong khung website, có nút về trang chủ. */
export default function NotFoundPage() {
  return (
    <div className="site-container py-20">
      <SiteEmpty
        icon={Compass}
        title="Không tìm thấy trang"
        description="Đường dẫn có thể đã thay đổi hoặc không tồn tại."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/" className="site-btn site-btn-primary">Về trang chủ</Link>
            <Link to="/thuc-don" className="site-btn site-btn-ghost">Xem thực đơn</Link>
          </div>
        }
      />
    </div>
  );
}
