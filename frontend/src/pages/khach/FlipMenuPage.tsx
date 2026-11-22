import { useSearchParams } from 'react-router-dom';
import { UtensilsCrossed } from 'lucide-react';
import { FlipMenu } from '@/features/public-site/flipbook/FlipMenu';
import { paperFromQuery } from '@/features/public-site/flipbook/theme';
import { usePublicMenu } from '@/features/public-site/queries';
import { SiteEmpty, SiteError, SiteSkeleton, useSiteData } from '@/features/public-site/parts';

const ALL = { keyword: '', categoryId: '' };

/**
 * /thuc-don — thực đơn dạng sách lật trang. Dùng cùng dữ liệu với dạng danh sách (GET /api/public/site/menu);
 * dạng danh sách cũ (MenuPage) vẫn giữ ở /thuc-don/danh-sach. ?q=… (ô tìm ở thanh đầu trang) mở sẵn kết quả tìm;
 * ?nen=1|2|3 xem thử nền trang (giấy kem / line-art / kraft — mặc định đặt trong flipbook/theme.ts).
 */
export default function FlipMenuPage() {
  const site = useSiteData();
  const [params] = useSearchParams();
  const menu = usePublicMenu(ALL);

  if (menu.isError) {
    return (
      <div className="site-container py-16">
        <SiteError onRetry={() => void menu.refetch()} retrying={menu.isFetching} />
      </div>
    );
  }
  if (!menu.data) {
    return (
      <div className="flex items-center justify-center p-6" style={{ height: 'calc(100dvh - var(--site-header-h))' }} aria-busy="true" aria-label="Đang tải thực đơn">
        <SiteSkeleton className="aspect-[3/4] h-full max-h-[640px]" />
      </div>
    );
  }
  if (!menu.data.totalItems && !menu.data.sets.length) {
    return (
      <div className="site-container py-16">
        <SiteEmpty icon={UtensilsCrossed} title="Thực đơn đang được cập nhật" description="Vui lòng quay lại sau hoặc gọi nhà hàng để được tư vấn món." />
      </div>
    );
  }
  return <FlipMenu menu={menu.data} site={site} initialQuery={params.get('q') ?? ''} paper={paperFromQuery(params.get('nen'))} />;
}
