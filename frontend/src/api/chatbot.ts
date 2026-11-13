import { conversationSeed, dishMentionSeed } from '@/mocks/chatbot';
import { matchesKeyword } from '@/lib/normalize';
import { delay, paginate, toDateKey } from '@/lib/mock';
import { api } from '@/lib/http';
import type {
  ChatbotConfig,
  ChatbotStats,
  Combo,
  ComboInput,
  Conversation,
  ConversationFilter,
  Dish,
  Faq,
  FaqCategory,
  FaqInput,
  MenuSyncResult,
  Paged,
  UnansweredQuestion,
} from '@/types';

const conversations: Conversation[] = conversationSeed;

export const CONVERSATION_PAGE_SIZE = 8;

/* ------------------------------------------------------------ Cấu hình (dữ liệu thật) */

/** GET /api/chatbot/config */
export function getChatbotConfig(): Promise<ChatbotConfig> {
  return api.get<ChatbotConfig>('/api/chatbot/config');
}

/**
 * PUT /api/chatbot/config — áp dụng cho phiên chat tiếp theo. Cảnh báo dị ứng bắt buộc; tối đa 6 gợi ý nhanh,
 * mỗi gợi ý ≤ 30 ký tự, không trùng.
 */
export function updateChatbotConfig(input: Omit<ChatbotConfig, 'updatedAt'>): Promise<ChatbotConfig> {
  return api.put<ChatbotConfig>('/api/chatbot/config', input);
}

/* ------------------------------------------------------------ Thực đơn cho AI (dữ liệu thật) */

/** GET /api/chatbot/menu — toàn bộ món (dùng chung bảng món với trang Quản lý món ăn) + lần đồng bộ gần nhất. */
export function getChatbotMenu(): Promise<{ dishes: Dish[]; lastSync: MenuSyncResult | null }> {
  return api.get<{ dishes: Dish[]; lastSync: MenuSyncResult | null }>('/api/chatbot/menu');
}

/**
 * POST /api/chatbot/menu/sync — đồng bộ thực đơn vào kho tri thức AI.
 * Món "Ngừng bán" không được gợi ý; món thiếu thành phần / mô tả được cảnh báo để AI không khẳng định.
 */
export function syncChatbotMenu(): Promise<MenuSyncResult> {
  return api.post<MenuSyncResult>('/api/chatbot/menu/sync');
}

/** PATCH /api/chatbot/menu/{dishId} { aiEnabled?, aiTags? } — 409 nếu bật gợi ý món đang ngừng bán. */
export function updateDishAi(id: string, patch: { aiEnabled?: boolean; aiTags?: string[] }): Promise<Dish> {
  return api.patch<Dish>(`/api/chatbot/menu/${encodeURIComponent(id)}`, {
    aiEnabled: patch.aiEnabled,
    aiTags: patch.aiTags,
  });
}

/** GET /api/chatbot/ai-tags — thẻ phân loại món cho AI (bảng ai_tags). */
export function getAiTags(): Promise<string[]> {
  return api.get<string[]>('/api/chatbot/ai-tags');
}

/** GET /api/chatbot/combos */
export function getCombos(): Promise<Combo[]> {
  return api.get<Combo[]>('/api/chatbot/combos');
}

/** POST /api/chatbot/combos | PUT /api/chatbot/combos/{id} — tối thiểu 2 món, không chứa món ngừng bán. */
export function saveCombo(id: string | null, input: ComboInput): Promise<Combo> {
  return id
    ? api.put<Combo>(`/api/chatbot/combos/${encodeURIComponent(id)}`, input)
    : api.post<Combo>('/api/chatbot/combos', input);
}

/** DELETE /api/chatbot/combos/{id} */
export function deleteCombo(id: string): Promise<void> {
  return api.delete(`/api/chatbot/combos/${encodeURIComponent(id)}`);
}

/* ------------------------------------------------------------ FAQ (dữ liệu thật) */

/** GET /api/chatbot/faqs — FAQ (mới cập nhật trước) + danh mục. */
export function getFaqs(): Promise<{ faqs: Faq[]; categories: FaqCategory[] }> {
  return api.get<{ faqs: Faq[]; categories: FaqCategory[] }>('/api/chatbot/faqs');
}

/**
 * GET /api/chatbot/unanswered — câu khách hay hỏi mà bot chưa trả lời được (nhiều lần hỏi trước).
 * Hiện chỉ có dữ liệu mẫu (db/dev); phân hệ Khách hàng (chat với bot) sẽ ghi bảng này.
 */
export function getUnansweredQuestions(): Promise<UnansweredQuestion[]> {
  return api.get<UnansweredQuestion[]>('/api/chatbot/unanswered');
}

/** POST /api/chatbot/faqs | PUT /api/chatbot/faqs/{id} — fromUnansweredId: câu hỏi được giải đáp bởi FAQ này. */
export function saveFaq(id: string | null, input: FaqInput): Promise<Faq> {
  return id ? api.put<Faq>(`/api/chatbot/faqs/${encodeURIComponent(id)}`, input) : api.post<Faq>('/api/chatbot/faqs', input);
}

/** DELETE /api/chatbot/faqs/{id} */
export function deleteFaq(id: string): Promise<void> {
  return api.delete(`/api/chatbot/faqs/${encodeURIComponent(id)}`);
}

/** DELETE /api/chatbot/unanswered/{id} — bỏ qua câu hỏi không cần đưa vào FAQ (backend đánh dấu, không xóa). */
export function dismissUnanswered(id: string): Promise<void> {
  return api.delete(`/api/chatbot/unanswered/${encodeURIComponent(id)}`);
}

/* ------------------------------------------------------------ Lịch sử hội thoại — DỮ LIỆU GIẢ
 * Chỉ có dữ liệu thật khi khách chat với bot (phân hệ Khách hàng). Xem DU_LIEU_GIA.md. */

/** [BACKEND-TODO] GET /api/chatbot/conversations?keyword=&date=&status=&page= */
export async function getConversations(filter: ConversationFilter): Promise<Paged<Conversation>> {
  await delay(300);
  const items = conversations
    .filter((c) => (filter.status === 'all' ? true : c.status === filter.status))
    .filter((c) => (filter.date ? toDateKey(new Date(c.startedAt)) === filter.date : true))
    .filter(
      (c) =>
        !filter.keyword.trim() ||
        matchesKeyword(c.tableCode, filter.keyword) ||
        c.messages.some((m) => matchesKeyword(m.text, filter.keyword)),
    )
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  return paginate(items, filter.page, CONVERSATION_PAGE_SIZE);
}

/* ------------------------------------------------------------ Thống kê — DỮ LIỆU GIẢ
 * Tính từ lịch sử hội thoại thật khi có phân hệ Khách hàng. Xem DU_LIEU_GIA.md. */

/** [BACKEND-TODO] GET /api/chatbot/stats?days=7 */
export async function getChatbotStats(): Promise<ChatbotStats> {
  await delay(380);
  const total = conversations.length;
  const count = (s: Conversation['status']) => conversations.filter((c) => c.status === s).length;
  const messages = conversations.reduce((s, c) => s + c.messages.length, 0);
  const daily: ChatbotStats['daily'] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = toDateKey(d);
    const base = 18 + ((d.getDate() * 7) % 13) + (d.getDay() === 0 || d.getDay() === 6 ? 12 : 0);
    const real = conversations.filter((c) => toDateKey(new Date(c.startedAt)) === key);
    daily.push({
      label: `${['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
      conversations: base + real.length,
      fallback: Math.round(base * 0.12) + real.filter((c) => c.status === 'fallback').length,
    });
  }
  return {
    totalConversations: total,
    totalMessages: messages,
    answerRate: total ? (count('answered') / total) * 100 : 0,
    fallbackRate: total ? (count('fallback') / total) * 100 : 0,
    handoffRate: total ? (count('handoff') / total) * 100 : 0,
    avgMessages: total ? messages / total : 0,
    cartConversion: total ? (conversations.filter((c) => c.addedToCart.length > 0).length / total) * 100 : 0,
    topAskedDishes: Object.entries(dishMentionSeed)
      .map(([name, n]) => ({ dishId: name, name, count: n }))
      .sort((a, b) => b.count - a.count),
    daily,
  };
}
