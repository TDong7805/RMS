import {
  chatbotConfigSeed,
  conversationSeed,
  dishMentionSeed,
  faqCategorySeed,
  faqSeed,
  unansweredSeed,
} from '@/mocks/chatbot';
import { matchesKeyword } from '@/lib/normalize';
import { BusinessError, ValidationError, collapseSpaces, delay, paginate, toDateKey, uid } from '@/lib/mock';
import { logActivity } from './audit';
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

let config: ChatbotConfig = { ...chatbotConfigSeed, quickReplies: [...chatbotConfigSeed.quickReplies] };
const faqCategories: FaqCategory[] = faqCategorySeed.map((c) => ({ ...c }));
let faqs: Faq[] = faqSeed.map((f) => ({ ...f }));
let unanswered: UnansweredQuestion[] = unansweredSeed.map((u) => ({ ...u }));
const conversations: Conversation[] = conversationSeed;

export const CONVERSATION_PAGE_SIZE = 8;

/* ------------------------------------------------------------ Cấu hình */

/** [BACKEND-TODO] GET /api/chatbot/config */
export async function getChatbotConfig(): Promise<ChatbotConfig> {
  await delay(260);
  return { ...config, quickReplies: [...config.quickReplies] };
}

/** [BACKEND-TODO] PUT /api/chatbot/config — áp dụng cho phiên chat tiếp theo. */
export async function updateChatbotConfig(input: Omit<ChatbotConfig, 'updatedAt'>): Promise<ChatbotConfig> {
  await delay(450);
  const errors: Record<string, string> = {};
  if (!collapseSpaces(input.botName)) errors.botName = 'Vui lòng đặt tên cho trợ lý';
  else if (input.botName.length > 30) errors.botName = 'Tên tối đa 30 ký tự';
  if (!input.greeting.trim()) errors.greeting = 'Vui lòng nhập câu chào';
  else if (input.greeting.length > 300) errors.greeting = 'Câu chào tối đa 300 ký tự';
  const replies = input.quickReplies.map(collapseSpaces).filter(Boolean);
  if (replies.length > 6) errors.quickReplies = 'Tối đa 6 gợi ý nhanh';
  else if (replies.some((r) => r.length > 30)) errors.quickReplies = 'Mỗi gợi ý tối đa 30 ký tự';
  else if (new Set(replies.map((r) => r.toLowerCase())).size !== replies.length) errors.quickReplies = 'Gợi ý nhanh bị trùng';
  if (!input.fallbackMessage.trim()) errors.fallbackMessage = 'Vui lòng nhập câu trả lời khi ngoài phạm vi';
  if (!input.allergyDisclaimer.trim())
    errors.allergyDisclaimer = 'Cảnh báo dị ứng là bắt buộc theo nguyên tắc hoạt động của AI';
  if (input.personality.length > 500) errors.personality = 'Mô tả tính cách tối đa 500 ký tự';
  if (Object.keys(errors).length) throw new ValidationError(errors);
  config = { ...input, botName: collapseSpaces(input.botName), quickReplies: replies, updatedAt: new Date().toISOString() };
  logActivity('chatbot', 'Cập nhật cấu hình', `Cấu hình trợ lý "${config.botName}" (${config.active ? 'đang bật' : 'đang tắt'})`);
  return { ...config, quickReplies: [...config.quickReplies] };
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

/* ------------------------------------------------------------ FAQ */

/** [BACKEND-TODO] GET /api/chatbot/faqs */
export async function getFaqs(): Promise<{ faqs: Faq[]; categories: FaqCategory[] }> {
  await delay(240);
  return {
    faqs: [...faqs].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    categories: faqCategories.map((c) => ({ ...c })),
  };
}

/** [BACKEND-TODO] GET /api/chatbot/unanswered — câu khách hay hỏi mà bot chưa trả lời được. */
export async function getUnansweredQuestions(): Promise<UnansweredQuestion[]> {
  await delay(200);
  return [...unanswered].sort((a, b) => b.askedCount - a.askedCount);
}

function validateFaq(input: FaqInput, editingId: string | null) {
  const errors: Record<string, string> = {};
  const question = collapseSpaces(input.question);
  if (!question) errors.question = 'Vui lòng nhập câu hỏi';
  else if (question.length > 200) errors.question = 'Câu hỏi tối đa 200 ký tự';
  else if (faqs.some((f) => f.id !== editingId && f.question.toLowerCase() === question.toLowerCase()))
    errors.question = 'Câu hỏi đã có trong FAQ';
  if (!input.answer.trim()) errors.answer = 'Vui lòng nhập câu trả lời';
  else if (input.answer.length > 1000) errors.answer = 'Câu trả lời tối đa 1000 ký tự';
  if (!faqCategories.some((c) => c.id === input.categoryId)) errors.categoryId = 'Vui lòng chọn danh mục';
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return question;
}

/** [BACKEND-TODO] POST /api/chatbot/faqs | PUT /api/chatbot/faqs/{id} */
export async function saveFaq(id: string | null, input: FaqInput): Promise<Faq> {
  await delay(380);
  const question = validateFaq(input, id);
  const ts = new Date().toISOString();
  let saved: Faq;
  if (id) {
    const current = faqs.find((f) => f.id === id);
    if (!current) throw new BusinessError('FAQ không tồn tại');
    saved = { ...current, question, answer: input.answer.trim(), categoryId: input.categoryId, active: input.active, updatedAt: ts };
    faqs = faqs.map((f) => (f.id === id ? saved : f));
    logActivity('chatbot', 'Sửa FAQ', question);
  } else {
    saved = { id: uid('faq'), question, answer: input.answer.trim(), categoryId: input.categoryId, active: input.active, updatedAt: ts };
    faqs = [saved, ...faqs];
    logActivity('chatbot', 'Thêm FAQ', question);
  }
  if (input.fromUnansweredId) unanswered = unanswered.filter((u) => u.id !== input.fromUnansweredId);
  return { ...saved };
}

/** [BACKEND-TODO] DELETE /api/chatbot/faqs/{id} */
export async function deleteFaq(id: string): Promise<void> {
  await delay(260);
  const current = faqs.find((f) => f.id === id);
  if (!current) throw new BusinessError('FAQ không tồn tại');
  faqs = faqs.filter((f) => f.id !== id);
  logActivity('chatbot', 'Xóa FAQ', current.question);
}

/** [BACKEND-TODO] DELETE /api/chatbot/unanswered/{id} — bỏ qua câu hỏi không cần đưa vào FAQ. */
export async function dismissUnanswered(id: string): Promise<void> {
  await delay(200);
  unanswered = unanswered.filter((u) => u.id !== id);
}

/* ------------------------------------------------------------ Lịch sử hội thoại */

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

/* ------------------------------------------------------------ Thống kê */

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
