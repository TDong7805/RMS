import type { OpeningDay } from './management';

/* =========================================================== Website khách hàng (công khai) */

export interface SiteBrand {
  name: string;
  logo: string | null;
  slogan: string;
  /** Danh hiệu / giải thưởng hiện ở banner, vd. "Michelin Selected 2026". Rỗng = không hiện. */
  award: string;
  /** Ảnh banner; null khi chưa có cả ảnh banner lẫn ảnh bìa nhà hàng. */
  heroImage: string | null;
}

export interface SiteAbout {
  title: string;
  paragraphs: string[];
  highlights: string[];
  image: string | null;
}

export interface SiteContact {
  phone: string;
  email: string;
  address: string;
  website: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  youtubeUrl: string;
  zaloPhone: string;
  mapUrl: string;
}

export interface SiteReservationSettings {
  slotMinutes: number;
  durationMinutes: number;
  minGuests: number;
  maxGuests: number;
  leadTimeMinutes: number;
  maxDaysAhead: number;
  requireEmail: boolean;
  allowAreaChoice: boolean;
  allowNote: boolean;
  notice: string;
}

export interface SiteArea {
  id: string;
  name: string;
  description: string;
}

export interface PublicSite {
  brand: SiteBrand;
  about: SiteAbout;
  contact: SiteContact;
  openingHours: OpeningDay[];
  reservation: SiteReservationSettings;
  /** Rỗng khi cấu hình không cho khách chọn khu vực. */
  areas: SiteArea[];
  /** Ngày hiện tại theo giờ nhà hàng (yyyy-MM-dd). */
  today: string;
  /** Giờ máy chủ (ISO UTC) — tính giờ đặt sớm nhất không phụ thuộc đồng hồ máy khách. */
  serverTime: string;
  /** Lời từ bếp trưởng; null = chưa nhập lá thư (ẩn mục). */
  chef: SiteChef | null;
  /** Ảnh cạnh form đặt bàn ở trang chủ. */
  reserveImage: string | null;
  /** Món đặc trưng (ảnh lớn tự trượt); rỗng = dùng món bán chạy. */
  signatures: SiteHighlight[];
  /** Trải nghiệm (tiệc, hẹn hò…); set menu do website tự lấy từ thực đơn. */
  experiences: SiteHighlight[];
  /** Số liệu khối Không gian, lấy từ sơ đồ bàn. */
  space: SiteSpace;
}

export interface SiteChef {
  name: string;
  title: string;
  paragraphs: string[];
  image: string | null;
}

export interface SiteHighlight {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  image: string | null;
}

export interface SiteSpace {
  floors: number;
  areas: number;
  tables: number;
  seats: number;
}

export interface PublicCategory {
  id: string;
  name: string;
  image: string | null;
}

export interface PublicMenuItem {
  /** Id món, hoặc "g" + id nhóm khi gộp nhiều loại (vd. Nước ngọt có ga). */
  id: string;
  name: string;
  categoryId: string;
  price: number;
  /** Nhiều mức giá: price là giá thấp nhất ("từ …"). */
  priceFrom: boolean;
  description: string;
  image: string | null;
  spicyLevel: number;
  allergens: string[];
  variants: string[];
  soldOut: boolean;
}

export interface PublicSetMenu {
  id: string;
  name: string;
  description: string;
  image: string | null;
  price: number;
  originalPrice: number;
  sellFrom: string | null;
  sellTo: string | null;
  items: string[];
}

export interface PublicMenu {
  categories: PublicCategory[];
  items: PublicMenuItem[];
  sets: PublicSetMenu[];
  /** Id các mục nổi bật (món bán chạy), dùng ở trang chủ. */
  featured: string[];
  /** Tổng số mục trên website (không tính bộ lọc). */
  totalItems: number;
}

export interface PublicMenuFilter {
  keyword: string;
  /** Id danh mục, "set" = chỉ set menu, rỗng = tất cả. */
  categoryId: string;
}

export interface GalleryPhoto {
  id: string;
  image: string;
  caption: string;
}

export interface PublicReservationInput {
  customerName: string;
  phone: string;
  email: string;
  guests: number | null;
  date: string;
  time: string;
  areaId: string;
  note: string;
}

export interface PublicReservationResult {
  code: string;
  status: 'pending' | 'confirmed';
  customerName: string;
  guests: number;
  dateTime: string;
  areaName: string;
}

/* =========================================================== Cấu hình website (Quản lý nhà hàng) */

export interface WebsiteContent {
  slogan: string;
  award: string;
  /** Gửi data URL khi chọn ảnh mới, địa chỉ cũ để giữ nguyên, null để bỏ ảnh. */
  heroImage: string | null;
  aboutTitle: string;
  aboutContent: string;
  /** Mỗi dòng một điểm nhấn. */
  aboutHighlights: string;
  aboutImage: string | null;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  youtubeUrl: string;
  zaloPhone: string;
  mapUrl: string;
  chefName: string;
  chefTitle: string;
  /** Xuống dòng = sang đoạn mới. Để trống thì website ẩn mục Lời từ bếp trưởng. */
  chefLetter: string;
  chefImage: string | null;
  reserveImage: string | null;
  updatedAt: string;
}

export type WebsiteFeatureKind = 'signature' | 'experience';

export interface WebsiteFeature {
  id: string;
  kind: WebsiteFeatureKind;
  title: string;
  subtitle: string;
  description: string;
  image: string | null;
  visible: boolean;
  sortOrder: number;
}

export interface WebsiteFeatureInput {
  kind: WebsiteFeatureKind;
  title: string;
  subtitle: string;
  description: string;
  image: string | null;
  visible: boolean;
}

export type WebsiteContentInput = Omit<WebsiteContent, 'updatedAt'>;

export interface WebsitePhoto {
  id: string;
  image: string;
  caption: string;
  visible: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface WebsitePhotoInput {
  image: string | null;
  caption: string;
  visible: boolean;
}

export interface WebsiteMenuDish {
  id: string;
  code: string;
  name: string;
  price: number;
  status: 'selling' | 'stopped';
  showOnWebsite: boolean;
  image: string | null;
}

export interface WebsiteMenuCategory {
  id: string;
  name: string;
  active: boolean;
  showOnWebsite: boolean;
  dishes: WebsiteMenuDish[];
}

/* ------------------------------------------------------------ Chatbot tư vấn trên website (V27) */

/** active = công tắc chung VÀ "Hiện trên website khách hàng" (Quản lý Chatbot) đều bật. */
export interface SiteAssistantIntro {
  active: boolean;
  botName: string;
  avatar: string;
  greeting: string;
  chips: string[];
}

/** Thẻ món / set chatbot gợi ý; id theo thực đơn website (món, hoặc "g" + id nhóm). */
export interface SiteAssistantCard {
  kind: 'dish' | 'set';
  id: string;
  name: string;
  price: number;
  priceFrom: boolean;
  image: string | null;
  note: string | null;
  qty: number;
  soldOut: boolean;
}

export type SiteAssistantAction = 'reservation' | 'contact';

export interface SiteAssistantReply {
  text: string;
  cards: SiteAssistantCard[];
  chips: string[];
  actions: SiteAssistantAction[];
  /** ai = Gemini, rules = bộ trả lời theo luật. */
  source?: 'ai' | 'rules';
}

export interface SiteAssistantQuestion {
  message: string;
  /** Vài câu khách hỏi trước (cũ → mới). */
  history: string[];
  /** Id các thẻ đã hiện — để gợi ý món khác khi khách hỏi "món khác". */
  shown: string[];
  sessionId: string;
}
