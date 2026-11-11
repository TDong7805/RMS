import { Construction } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { useNavigate } from 'react-router-dom';

export interface PlaceholderPageProps {
  title: string;
  parent?: string;
  description?: string;
}

export function PlaceholderPage({ title, parent, description }: PlaceholderPageProps) {
  const navigate = useNavigate();

  return (
    <AppShell meta={{ label: title, parent }}>
      <div className="min-w-0 space-y-4">
        <div className="min-w-0">
          <h1 className="truncate text-[26px] font-bold leading-tight tracking-[-0.02em] text-[var(--text-primary)] sm:text-[30px]">
            {title}
          </h1>
          <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
            {description ?? 'Trang này đang được hoàn thiện trong phiên bản tiếp theo.'}
          </p>
        </div>

        <Card padded>
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <span
              className="grid h-12 w-12 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]"
              aria-hidden
            >
              <Construction size={22} strokeWidth={1.75} />
            </span>
            <div className="max-w-[440px]">
              <p className="text-[15px] font-semibold text-[var(--text-primary)]">
                Chức năng đang được xây dựng
              </p>
              <p className="mt-1 text-[13px] leading-5 text-[var(--text-muted)]">
                Điều hướng và breadcrumb đã hoạt động. Nội dung chi tiết của mục “{title}” sẽ được
                bổ sung khi hoàn thiện phần nghiệp vụ.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/')}>
              Về Dashboard
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

export default PlaceholderPage;
