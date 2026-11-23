package com.rms.ordering;

import com.rms.common.Db;
import com.rms.common.Ids;
import com.rms.common.Paged;
import com.rms.common.Times;
import com.rms.common.Vi;
import com.rms.ordering.MenuAssistant.Reply;
import com.rms.ordering.MenuAssistant.Suggestion;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lưu hội thoại thật của trợ lý gọi món (trang QR) và cung cấp cho Quản lý Chatbot: "Lịch sử hội thoại", "Thống kê".
 *
 * <p>Một hội thoại = một phiên chat trên một thiết bị (sessionId do trình duyệt tạo, giữ trong sessionStorage), gắn bàn
 * và đơn đang mở. Trạng thái: answered (bot trả lời được) → fallback (có câu bot không trả lời được) → handoff (khách cần
 * nhân viên / thanh toán); chỉ nâng, không hạ. Ghi lỗi không bao giờ làm hỏng câu trả lời cho khách.
 */
@Service
public class ChatLogService {
    private static final Logger log = LoggerFactory.getLogger(ChatLogService.class);
    static final int PAGE_SIZE = 8;
    private static final Map<String, Integer> RANK = Map.of("answered", 0, "fallback", 1, "handoff", 2);

    public record Message(String from, String text, String at) {}

    public record Conversation(String id, String tableCode, String startedAt, String status, List<Message> messages,
                               List<String> addedToCart) {}

    public record TopDish(String dishId, String name, int count) {}

    public record Day(String label, int conversations, int fallback) {}

    public record Stats(int totalConversations, int totalMessages, double answerRate, double fallbackRate, double handoffRate,
                        double avgMessages, double cartConversion, List<TopDish> topAskedDishes, List<Day> daily) {}

    public record CartAdd(String kind, String id, Integer qty) {}

    private final JdbcClient jdbc;

    public ChatLogService(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    static String cleanSession(String s) {
        return s != null && s.matches("[0-9a-fA-F-]{36}") ? s.toLowerCase() : null;
    }

    static boolean wantsStaff(String text) {
        String n = " " + Vi.normalize(text).replaceAll("[^a-z0-9]+", " ") + " ";
        for (String k : List.of(" goi nhan vien ", " nhan vien ", " goi phuc vu ", " ho tro ", " thanh toan ", " tinh tien "))
            if (n.contains(k)) return true;
        return false;
    }

    /** Hội thoại của phiên (tạo mới nếu chưa có). */
    private long conversation(long tableId, String session) {
        var found = jdbc.sql("SELECT id FROM chat_conversations WHERE session_token = ?").param(session).query(Long.class).optional();
        if (found.isPresent()) return found.get();
        Long order = jdbc.sql("SELECT id FROM orders WHERE table_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1")
            .param(tableId).query(Long.class).optional().orElse(null);
        jdbc.sql("INSERT INTO chat_conversations (table_id, order_id, session_token, status, started_at) VALUES (?, ?, ?, 'answered', ?)")
            .params(tableId, order, session, Times.now()).update();
        return jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
    }

    /** Ghi một lượt hỏi – đáp. Lỗi chỉ ghi log (REQUIRES_NEW: không ảnh hưởng giao dịch khác). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(long tableId, String sessionId, String question, Reply reply, boolean fallback) {
        try {
            String session = cleanSession(sessionId);
            if (session == null) session = UUID.randomUUID().toString();
            long conv = conversation(tableId, session);
            LocalDateTime now = Times.now();
            jdbc.sql("INSERT INTO chat_messages (conversation_id, sender, content, created_at) VALUES (?, 'customer', ?, ?)")
                .params(conv, question, now).update();
            jdbc.sql("INSERT INTO chat_messages (conversation_id, sender, content, is_fallback, source, created_at) VALUES (?, 'bot', ?, ?, ?, ?)")
                .params(conv, reply.text(), fallback, "ai".equals(reply.source()) ? "ai" : "rules", now.plusNanos(1_000_000)).update();
            long msg = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
            for (Suggestion s : reply.items())
                if ("dish".equals(s.kind()))
                    jdbc.sql("INSERT IGNORE INTO chat_message_dishes (message_id, dish_id) VALUES (?, ?)").params(msg, Long.parseLong(s.id())).update();
            String status = wantsStaff(question) ? "handoff" : fallback ? "fallback" : "answered";
            jdbc.sql("""
                    UPDATE chat_conversations SET ended_at = ?,
                      status = CASE WHEN FIELD(status, 'answered', 'fallback', 'handoff') < FIELD(?, 'answered', 'fallback', 'handoff') THEN ? ELSE status END
                    WHERE id = ?
                    """).params(now, status, status, conv).update();
        } catch (Exception e) {
            log.warn("Không lưu được hội thoại chatbot: {}", e.getMessage());
        }
    }

    /** Khách bấm "Thêm" trên thẻ gợi ý của bot. */
    @Transactional
    public int cartAdds(long tableId, String sessionId, List<CartAdd> adds) {
        String session = cleanSession(sessionId);
        if (session == null || adds == null || adds.isEmpty()) return 0;
        long conv = conversation(tableId, session);
        int n = 0;
        for (CartAdd a : adds.stream().limit(20).toList()) {
            Long id = Ids.parseOrNull(a.id());
            if (id == null) continue;
            int qty = a.qty() == null ? 1 : Math.max(1, Math.min(20, a.qty()));
            boolean set = "set".equals(a.kind());
            if (jdbc.sql(set ? "SELECT COUNT(*) FROM combos WHERE id = ?" : "SELECT COUNT(*) FROM dishes WHERE id = ?").param(id).query(Long.class).single() == 0)
                continue;
            jdbc.sql("INSERT INTO chat_cart_adds (conversation_id, dish_id, combo_id, quantity) VALUES (?, ?, ?, ?)")
                .params(conv, set ? null : id, set ? id : null, qty).update();
            n++;
        }
        return n;
    }

    /* ======================================================================= Quản lý */

    public Paged<Conversation> list(String keyword, String date, String status, int page) {
        List<Object> params = new ArrayList<>();
        StringBuilder where = new StringBuilder(" WHERE 1 = 1");
        if (status != null && RANK.containsKey(status)) { where.append(" AND c.status = ?"); params.add(status); }
        LocalDate d = Times.parseDate(date);
        if (d != null) { where.append(" AND c.started_at >= ? AND c.started_at < ?"); params.add(d.atStartOfDay()); params.add(d.plusDays(1).atStartOfDay()); }
        String kw = Vi.collapse(keyword);
        if (!kw.isEmpty()) {
            where.append(" AND (t.code LIKE ? OR EXISTS (SELECT 1 FROM chat_messages m WHERE m.conversation_id = c.id AND m.content LIKE ?))");
            params.add("%" + kw + "%");
            params.add("%" + kw + "%");
        }
        String from = " FROM chat_conversations c LEFT JOIN dining_tables t ON t.id = c.table_id";
        int total = jdbc.sql("SELECT COUNT(*)" + from + where).params(params).query(Integer.class).single();
        int pages = Math.max(1, (total + PAGE_SIZE - 1) / PAGE_SIZE);
        int p = Math.max(1, Math.min(page, pages));
        List<Object> pageParams = new ArrayList<>(params);
        pageParams.add(PAGE_SIZE);
        pageParams.add((p - 1) * PAGE_SIZE);
        record Head(long id, String table, LocalDateTime started, String status) {}
        List<Head> heads = jdbc.sql("SELECT c.id, t.code, c.started_at, c.status" + from + where + " ORDER BY c.started_at DESC, c.id DESC LIMIT ? OFFSET ?")
            .params(pageParams)
            .query((rs, n) -> new Head(rs.getLong(1), rs.getString(2), Db.dateTime(rs, "started_at"), rs.getString(4))).list();
        if (heads.isEmpty()) return new Paged<>(List.of(), total, p, pages);
        String ids = String.join(",", heads.stream().map((h) -> Long.toString(h.id())).toList());
        Map<Long, List<Message>> msgs = new HashMap<>();
        jdbc.sql("SELECT conversation_id, sender, content, created_at FROM chat_messages WHERE conversation_id IN (" + ids + ") ORDER BY created_at, id")
            .query((rs, n) -> msgs.computeIfAbsent(rs.getLong(1), k -> new ArrayList<>())
                .add(new Message(rs.getString(2), rs.getString(3), Times.iso(Db.dateTime(rs, "created_at"))))).list();
        Map<Long, List<String>> adds = new HashMap<>();
        jdbc.sql("""
                SELECT a.conversation_id, CONCAT(IF(a.quantity > 1, CONCAT(a.quantity, ' × '), ''), COALESCE(d.name, s.name)) AS name
                FROM chat_cart_adds a LEFT JOIN dishes d ON d.id = a.dish_id LEFT JOIN combos s ON s.id = a.combo_id
                WHERE a.conversation_id IN (""" + ids + ") ORDER BY a.id")
            .query((rs, n) -> adds.computeIfAbsent(rs.getLong(1), k -> new ArrayList<>()).add(rs.getString(2))).list();
        List<Conversation> items = heads.stream().map((h) -> new Conversation(Long.toString(h.id()), h.table() == null ? "—" : h.table(),
            Times.iso(h.started()), h.status(), msgs.getOrDefault(h.id(), List.of()), adds.getOrDefault(h.id(), List.of()))).toList();
        return new Paged<>(items, total, p, pages);
    }

    /** Thống kê {@code days} ngày gần nhất (gồm hôm nay). */
    public Stats stats(int days) {
        int n = Math.max(1, Math.min(days, 90));
        LocalDateTime since = Times.today().minusDays(n - 1L).atStartOfDay();
        Map<String, Integer> count = new HashMap<>(Map.of("answered", 0, "fallback", 0, "handoff", 0));
        jdbc.sql("SELECT status, COUNT(*) FROM chat_conversations WHERE started_at >= ? GROUP BY status").param(since)
            .query((rs, i) -> count.put(rs.getString(1), rs.getInt(2))).list();
        int total = count.values().stream().mapToInt(Integer::intValue).sum();
        int messages = jdbc.sql("SELECT COUNT(*) FROM chat_messages m JOIN chat_conversations c ON c.id = m.conversation_id WHERE c.started_at >= ?")
            .param(since).query(Integer.class).single();
        int withAdds = jdbc.sql("SELECT COUNT(DISTINCT a.conversation_id) FROM chat_cart_adds a JOIN chat_conversations c ON c.id = a.conversation_id WHERE c.started_at >= ?")
            .param(since).query(Integer.class).single();
        List<TopDish> top = jdbc.sql("""
                SELECT d.id, d.name, COUNT(*) AS n FROM chat_message_dishes md JOIN chat_messages m ON m.id = md.message_id
                JOIN dishes d ON d.id = md.dish_id WHERE m.created_at >= ? GROUP BY d.id, d.name ORDER BY n DESC, d.name LIMIT 8
                """).param(since)
            .query((rs, i) -> new TopDish(Long.toString(rs.getLong(1)), rs.getString(2), rs.getInt(3))).list();
        Map<LocalDate, int[]> perDay = new LinkedHashMap<>();
        for (int i = n - 1; i >= 0; i--) perDay.put(Times.today().minusDays(i), new int[2]);
        jdbc.sql("SELECT DATE(started_at) AS d, COUNT(*), SUM(status = 'fallback') FROM chat_conversations WHERE started_at >= ? GROUP BY DATE(started_at)")
            .param(since)
            .query((rs, i) -> {
                int[] v = perDay.get(rs.getDate(1).toLocalDate());
                if (v != null) { v[0] = rs.getInt(2); v[1] = rs.getInt(3); }
                return null;
            }).list();
        String[] dow = {"CN", "T2", "T3", "T4", "T5", "T6", "T7"};
        List<Day> daily = perDay.entrySet().stream().map((e) -> new Day(
            "%s %02d/%02d".formatted(dow[e.getKey().getDayOfWeek().getValue() % 7], e.getKey().getDayOfMonth(), e.getKey().getMonthValue()),
            e.getValue()[0], e.getValue()[1])).toList();
        double pct = total == 0 ? 0 : 100.0 / total;
        return new Stats(total, messages, count.get("answered") * pct, count.get("fallback") * pct, count.get("handoff") * pct,
            total == 0 ? 0 : (double) messages / total, withAdds * pct, top, daily);
    }
}
