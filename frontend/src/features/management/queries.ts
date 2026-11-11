import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getAccounts } from '@/api/accounts';
import { getAuditActors, getAuditLogs } from '@/api/audit';
import {
  getChatbotConfig,
  getChatbotMenu,
  getChatbotStats,
  getCombos,
  getConversations,
  getFaqs,
  getUnansweredQuestions,
} from '@/api/chatbot';
import { getCategories, getDish, getDishes } from '@/api/dishes';
import { getPost, getPosts } from '@/api/posts';
import {
  getReservation,
  getReservationFormConfig,
  getReservationSummary,
  getReservations,
} from '@/api/reservations';
import { getBackups, getOpeningHours, getRestaurantInfo } from '@/api/settings';
import { getAssignments, getEmployees, getShifts } from '@/api/shifts';
import { getAreas, getTables } from '@/api/tables';
import type {
  AccountFilter,
  AuditFilter,
  ConversationFilter,
  DishFilter,
  PostFilter,
  ReservationFilter,
} from '@/types';

/** Khóa query dùng chung để các màn hình invalidate lẫn nhau sau khi lưu. */
export const qk = {
  reservations: ['reservations'] as const,
  reservationForm: ['reservation-form'] as const,
  areas: ['areas'] as const,
  tables: ['tables'] as const,
  dishes: ['dishes'] as const,
  categories: ['dish-categories'] as const,
  accounts: ['accounts'] as const,
  employees: ['employees'] as const,
  shifts: ['shifts'] as const,
  assignments: ['shift-assignments'] as const,
  posts: ['posts'] as const,
  chatbot: ['chatbot'] as const,
  audit: ['audit'] as const,
  settings: ['settings'] as const,
};

/* ---------------- Đặt bàn & bàn */
export const useReservations = (f: ReservationFilter) =>
  useQuery({ queryKey: [...qk.reservations, 'list', f], queryFn: () => getReservations(f), placeholderData: keepPreviousData });
export const useReservation = (id: string | null) =>
  useQuery({ queryKey: [...qk.reservations, 'detail', id], queryFn: () => getReservation(id!), enabled: Boolean(id), retry: false });
export const useReservationSummary = () =>
  useQuery({ queryKey: [...qk.reservations, 'summary'], queryFn: getReservationSummary });
export const useReservationForm = () => useQuery({ queryKey: qk.reservationForm, queryFn: getReservationFormConfig });
export const useAreas = () => useQuery({ queryKey: qk.areas, queryFn: getAreas, staleTime: 60_000 });
export const useTables = () => useQuery({ queryKey: qk.tables, queryFn: getTables, staleTime: 30_000 });

/* ---------------- Món ăn */
export const useDishes = (f: DishFilter) =>
  useQuery({ queryKey: [...qk.dishes, 'list', f], queryFn: () => getDishes(f), placeholderData: keepPreviousData });
export const useDish = (id: string | undefined) =>
  useQuery({ queryKey: [...qk.dishes, 'detail', id], queryFn: () => getDish(id!), enabled: Boolean(id), retry: false });
export const useCategories = () => useQuery({ queryKey: qk.categories, queryFn: getCategories });

/* ---------------- Tài khoản & ca làm */
export const useAccounts = (f: AccountFilter) =>
  useQuery({ queryKey: [...qk.accounts, 'list', f], queryFn: () => getAccounts(f), placeholderData: keepPreviousData });
export const useEmployees = () => useQuery({ queryKey: qk.employees, queryFn: getEmployees });
export const useShifts = () => useQuery({ queryKey: qk.shifts, queryFn: getShifts });
export const useAssignments = (from: string, to: string) =>
  useQuery({ queryKey: [...qk.assignments, from, to], queryFn: () => getAssignments(from, to), placeholderData: keepPreviousData });

/* ---------------- Bài viết */
export const usePosts = (f: PostFilter) =>
  useQuery({ queryKey: [...qk.posts, 'list', f], queryFn: () => getPosts(f), placeholderData: keepPreviousData });
export const usePost = (id: string | undefined) =>
  useQuery({ queryKey: [...qk.posts, 'detail', id], queryFn: () => getPost(id!), enabled: Boolean(id), retry: false });

/* ---------------- Chatbot AI */
export const useChatbotConfig = () => useQuery({ queryKey: [...qk.chatbot, 'config'], queryFn: getChatbotConfig });
export const useChatbotMenu = () => useQuery({ queryKey: [...qk.chatbot, 'menu'], queryFn: getChatbotMenu });
export const useCombos = () => useQuery({ queryKey: [...qk.chatbot, 'combos'], queryFn: getCombos });
export const useFaqs = () => useQuery({ queryKey: [...qk.chatbot, 'faqs'], queryFn: getFaqs });
export const useUnanswered = () => useQuery({ queryKey: [...qk.chatbot, 'unanswered'], queryFn: getUnansweredQuestions });
export const useConversations = (f: ConversationFilter) =>
  useQuery({ queryKey: [...qk.chatbot, 'conversations', f], queryFn: () => getConversations(f), placeholderData: keepPreviousData });
export const useChatbotStats = () => useQuery({ queryKey: [...qk.chatbot, 'stats'], queryFn: getChatbotStats });

/* ---------------- Nhật ký & cấu hình */
export const useAuditLogs = (f: AuditFilter) =>
  useQuery({ queryKey: [...qk.audit, 'list', f], queryFn: () => getAuditLogs(f), placeholderData: keepPreviousData });
export const useAuditActors = () => useQuery({ queryKey: [...qk.audit, 'actors'], queryFn: getAuditActors });
export const useRestaurantInfo = () => useQuery({ queryKey: [...qk.settings, 'info'], queryFn: getRestaurantInfo });
export const useOpeningHours = () => useQuery({ queryKey: [...qk.settings, 'hours'], queryFn: getOpeningHours });
export const useBackups = () => useQuery({ queryKey: [...qk.settings, 'backups'], queryFn: getBackups });
