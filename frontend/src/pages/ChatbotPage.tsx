import { useSearchParams } from 'react-router-dom';
import { BarChart3, HelpCircle, MessagesSquare, Settings2, UtensilsCrossed } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader, PageTabs } from '@/components/common/PageParts';
import { ChatbotConfigTab } from '@/features/chatbot/ChatbotConfigTab';
import { ChatbotMenuTab } from '@/features/chatbot/ChatbotMenuTab';
import { ChatbotFaqTab } from '@/features/chatbot/ChatbotFaqTab';
import { ChatbotHistoryTab, ChatbotStatsTab } from '@/features/chatbot/ChatbotInsightsTabs';

type Tab = 'config' | 'menu' | 'faq' | 'history' | 'stats';
const TABS: Tab[] = ['config', 'menu', 'faq', 'history', 'stats'];

export function ChatbotPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab') as Tab | null;
  const tab: Tab = raw && TABS.includes(raw) ? raw : 'config';

  return (
    <AppShell meta={{ label: 'Quản lý Chatbot AI', parent: 'Hệ thống' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader title="Quản lý Chatbot AI" description="Cấu hình trợ lý ảo, kho tri thức (thực đơn, FAQ), lịch sử hội thoại và hiệu suất trả lời." />
        <PageTabs<Tab>
          ariaLabel="Phân khu quản lý chatbot"
          value={tab}
          onChange={(t) => setParams({ tab: t }, { replace: true })}
          items={[
            { value: 'config', label: 'Cấu hình Chatbot', icon: <Settings2 size={16} /> },
            { value: 'menu', label: 'Quản lý thực đơn', icon: <UtensilsCrossed size={16} /> },
            { value: 'faq', label: 'Quản lý FAQ', icon: <HelpCircle size={16} /> },
            { value: 'history', label: 'Lịch sử hội thoại', icon: <MessagesSquare size={16} /> },
            { value: 'stats', label: 'Thống kê & báo cáo', icon: <BarChart3 size={16} /> },
          ]}
        />
        {tab === 'config' ? <ChatbotConfigTab /> : null}
        {tab === 'menu' ? <ChatbotMenuTab /> : null}
        {tab === 'faq' ? <ChatbotFaqTab /> : null}
        {tab === 'history' ? <ChatbotHistoryTab /> : null}
        {tab === 'stats' ? <ChatbotStatsTab /> : null}
      </div>
    </AppShell>
  );
}

export default ChatbotPage;
