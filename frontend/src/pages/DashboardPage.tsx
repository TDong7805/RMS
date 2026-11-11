import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { RevenueCard } from '@/features/dashboard/RevenueCard';
import { InventoryCard } from '@/features/dashboard/InventoryCard';
import { TopDishesCard } from '@/features/dashboard/TopDishesCard';
import type { PeriodKey } from '@/types';

export function DashboardPage() {
  // Mỗi khối giữ mốc thời gian riêng: đổi mốc ở khối nào chỉ khối đó tải lại.
  const [revenuePeriod, setRevenuePeriod] = useState<PeriodKey>('today');
  const [inventoryPeriod, setInventoryPeriod] = useState<PeriodKey>('today');
  const [dishesPeriod, setDishesPeriod] = useState<PeriodKey>('today');

  return (
    <AppShell meta={{ label: 'Dashboard' }}>
      <div className="min-w-0 space-y-4 sm:space-y-5">
        <div className="min-w-0">
          <h1 className="truncate text-[26px] font-bold leading-tight tracking-[-0.02em] text-[var(--text-primary)] sm:text-[32px]">
            Tổng quan nhà hàng
          </h1>
          <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
            Tình hình kinh doanh và kho hàng trong một màn hình duy nhất.
          </p>
        </div>

        <RevenueCard period={revenuePeriod} onPeriodChange={setRevenuePeriod} />

        <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <InventoryCard period={inventoryPeriod} onPeriodChange={setInventoryPeriod} />
          <TopDishesCard period={dishesPeriod} onPeriodChange={setDishesPeriod} />
        </div>
      </div>
    </AppShell>
  );
}

export default DashboardPage;