package com.rms.website;

import com.rms.common.Ids;
import com.rms.common.Times;
import com.rms.common.Vi;
import com.rms.ordering.QrOrderingService;
import com.rms.ordering.QrOrderingService.Menu;
import com.rms.ordering.QrOrderingService.MenuDish;
import com.rms.ordering.QrOrderingService.MenuGroup;
import com.rms.reservation.ReservationFormConfigService;
import com.rms.reservation.ReservationFormConfigService.FormConfig;
import com.rms.settings.SettingsService;
import com.rms.settings.SettingsService.OpeningDay;
import com.rms.settings.SettingsService.RestaurantInfo;
import com.rms.storage.ImageStore;
import com.rms.table.TableService;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/**
 * Dữ liệu website khách hàng (công khai, không đăng nhập — /api/public/site/**). Chỉ đọc, không trả thông tin nội bộ
 * (mã số thuế, tên pháp nhân, thành phần khai báo cho AI…).
 *
 * Thực đơn dùng lại QrOrderingService.menu() (món đang bán của danh mục đang bật, nhóm món, set đang bán, món bán chạy)
 * rồi lọc thêm show_on_website của món / danh mục. Món trong một nhóm (vd. Coca-Cola, Sprite) gộp thành một mục
 * "từ … đ" kèm danh sách loại, giống thẻ trên trang gọi món.
 */
@Service
public class PublicSiteService {
    static final int FEATURED_LIMIT = 6;

    public record Brand(String name, String logo, String slogan, String award, String heroImage) {}

    public record About(String title, List<String> paragraphs, List<String> highlights, String image) {}

    public record Contact(String phone, String email, String address, String website, String facebookUrl,
                          String instagramUrl, String tiktokUrl, String youtubeUrl, String zaloPhone, String mapUrl) {}

    /** Phần cấu hình form đặt bàn khách cần biết (đặt trước tối thiểu leadTimeMinutes phút, tối đa maxDaysAhead ngày). */
    public record ReservationSettings(int slotMinutes, int durationMinutes, int minGuests, int maxGuests,
                                      int leadTimeMinutes, int maxDaysAhead, boolean requireEmail, boolean allowAreaChoice,
                                      boolean allowNote, String notice) {}

    public record AreaOption(String id, String name, String description) {}

    /** today: ngày hiện tại theo giờ nhà hàng (yyyy-MM-dd); serverTime: ISO UTC — để form tính giờ đặt sớm nhất. */
    public record Site(Brand brand, About about, Contact contact, List<OpeningDay> openingHours,
                       ReservationSettings reservation, List<AreaOption> areas, String today, String serverTime,
                       Chef chef, String reserveImage, List<Highlight> signatures, List<Highlight> experiences, Space space) {}

    /** Lời từ bếp trưởng; null khi chưa nhập lá thư (website ẩn mục). */
    public record Chef(String name, String title, List<String> paragraphs, String image) {}

    /** Một mục Món đặc trưng / Trải nghiệm đang hiện. */
    public record Highlight(String id, String title, String subtitle, String description, String image) {}

    /** Số liệu khối "Không gian", lấy từ sơ đồ bàn: chỉ tính khu đang phục vụ và bàn đang dùng. */
    public record Space(int floors, int areas, int tables, int seats) {}

    public record Category(String id, String name, String image) {}

    /** id: id món, hoặc "g" + id nhóm khi gộp nhiều loại; priceFrom = có nhiều mức giá, price là giá thấp nhất. */
    public record Item(String id, String name, String categoryId, long price, boolean priceFrom, String description,
                       String image, int spicyLevel, List<String> allergens, List<String> variants, boolean soldOut) {}

    public record SetMenu(String id, String name, String description, String image, long price, long originalPrice,
                          String sellFrom, String sellTo, List<String> items) {}

    /** categories: mọi danh mục có món hiện trên website (không phụ thuộc bộ lọc) — để vẽ thanh lọc ổn định. */
    public record PublicMenu(List<Category> categories, List<Item> items, List<SetMenu> sets, List<String> featured,
                             int totalItems) {}

    public record GalleryPhoto(String id, String image, String caption) {}

    private final JdbcClient jdbc;
    private final SettingsService settings;
    private final ReservationFormConfigService formConfig;
    private final TableService tables;
    private final QrOrderingService ordering;
    private final WebsiteContentService content;
    private final ImageStore images;

    public PublicSiteService(JdbcClient jdbc, SettingsService settings, ReservationFormConfigService formConfig,
                             TableService tables, QrOrderingService ordering, WebsiteContentService content, ImageStore images) {
        this.jdbc = jdbc;
        this.settings = settings;
        this.formConfig = formConfig;
        this.tables = tables;
        this.ordering = ordering;
        this.content = content;
        this.images = images;
    }

    /* ------------------------------------------------------------ Thông tin chung */

    public Site site() {
        RestaurantInfo info = settings.getInfo();
        WebsiteContentService.Row c = content.row();
        String hero = c.heroKey() != null ? images.url(c.heroKey()) : info.coverImage();
        Brand brand = new Brand(info.name(), info.logo(), c.slogan(), c.award(), hero);
        About about = new About(c.aboutTitle(), WebsiteContentService.lines(c.aboutContent()),
            WebsiteContentService.lines(c.highlights()), c.aboutKey() != null ? images.url(c.aboutKey()) : info.coverImage());
        Contact contact = new Contact(info.phone(), info.email(), info.address(), info.website(), c.facebook(), c.instagram(),
            c.tiktok(), c.youtube(), c.zalo(), c.map());
        FormConfig cfg = formConfig.get();
        ReservationSettings reservation = new ReservationSettings(cfg.slotMinutes(), cfg.durationMinutes(), cfg.minGuests(),
            cfg.maxGuests(), cfg.leadTimeMinutes(), cfg.maxDaysAhead(), cfg.requireEmail(), cfg.allowAreaChoice(), cfg.allowNote(),
            Vi.trim(cfg.notice()));
        Chef chef = Vi.blank(c.chefLetter()) ? null
            : new Chef(c.chefName(), c.chefTitle(), WebsiteContentService.lines(c.chefLetter()), images.url(c.chefKey()));
        return new Site(brand, about, contact, settings.getOpeningHours(), reservation,
            cfg.allowAreaChoice() ? bookableAreas() : List.of(), Times.today().toString(), Times.iso(Times.now()),
            chef, images.url(c.reserveKey()), highlights("signature"), highlights("experience"), space());
    }

    private List<Highlight> highlights(String kind) {
        return jdbc.sql("SELECT * FROM website_features WHERE kind = ? AND is_visible = 1 ORDER BY sort_order, id").param(kind)
            .query((rs, n) -> new Highlight(Ids.str(rs.getLong("id")), rs.getString("title"), Vi.trim(rs.getString("subtitle")),
                Vi.trim(rs.getString("description")), images.url(rs.getString("image_url"))))
            .list();
    }

    /** Bàn đang dùng (không tính bàn ngừng dùng) thuộc khu đang phục vụ; tầng = số tầng có ít nhất một bàn như vậy. */
    private Space space() {
        Map<String, TableService.Area> active = new LinkedHashMap<>();
        tables.areas().stream().filter(TableService.Area::active).forEach(a -> active.put(a.id(), a));
        Set<String> floors = new HashSet<>();
        Set<String> areas = new HashSet<>();
        int count = 0, seats = 0;
        for (var t : tables.tables()) {
            TableService.Area a = active.get(t.areaId());
            if (a == null || "inactive".equals(t.status())) continue;
            count++;
            seats += t.seats();
            areas.add(a.id());
            if (a.floorId() != null) floors.add(a.floorId());
        }
        return new Space(Math.max(floors.size(), count > 0 ? 1 : 0), areas.size(), count, seats);
    }

    /** Khu đang phục vụ và có ít nhất một bàn đang dùng — khách chọn được khi đặt bàn. */
    public List<AreaOption> bookableAreas() {
        Set<String> withTables = new HashSet<>();
        tables.tables().stream().filter(t -> !"inactive".equals(t.status())).forEach(t -> withTables.add(t.areaId()));
        return tables.areas().stream()
            .filter(a -> a.active() && withTables.contains(a.id()))
            .map(a -> new AreaOption(a.id(), a.name(), a.description()))
            .toList();
    }

    /* ------------------------------------------------------------ Thực đơn */

    /**
     * keyword: tìm không dấu theo tên, mô tả, loại, danh mục; categoryId: id danh mục, hoặc "set" để chỉ xem set menu.
     */
    public PublicMenu menu(String keyword, String categoryId) {
        Menu menu = ordering.menu();
        Set<String> hiddenDishes = new HashSet<>(jdbc.sql("SELECT id FROM dishes WHERE show_on_website = 0")
            .query((rs, n) -> Ids.str(rs.getLong("id"))).list());
        Set<String> hiddenCats = new HashSet<>(jdbc.sql("SELECT id FROM dish_categories WHERE show_on_website = 0")
            .query((rs, n) -> Ids.str(rs.getLong("id"))).list());

        List<MenuDish> dishes = menu.dishes().stream()
            .filter(d -> !hiddenDishes.contains(d.id()) && !hiddenCats.contains(d.categoryId())).toList();
        Map<String, MenuDish> byId = new LinkedHashMap<>();
        dishes.forEach(d -> byId.put(d.id(), d));

        List<Item> all = new ArrayList<>();
        Set<String> grouped = new HashSet<>();
        Map<String, MenuGroup> groups = new LinkedHashMap<>();
        menu.groups().forEach(g -> groups.put(g.id(), g));
        for (MenuDish d : dishes) {
            if (grouped.contains(d.id())) continue;
            MenuGroup g = d.groupId() == null ? null : groups.get(d.groupId());
            List<MenuDish> members = g == null ? List.of() : g.dishIds().stream().map(byId::get).filter(x -> x != null).toList();
            if (members.size() > 1) {
                members.forEach(x -> grouped.add(x.id()));
                long min = members.stream().mapToLong(MenuDish::price).min().orElse(d.price());
                boolean many = members.stream().anyMatch(x -> x.price() != min);
                List<String> variants = members.stream()
                    .map(x -> Vi.blank(x.variantLabel()) ? x.name() : x.variantLabel()).toList();
                List<String> allergens = members.stream().flatMap(x -> x.allergens().stream()).distinct().toList();
                String image = g.image() != null ? g.image() : members.stream().map(MenuDish::image).filter(x -> x != null).findFirst().orElse(null);
                all.add(new Item("g" + g.id(), g.name(), g.categoryId(), min, many,
                    Vi.blank(g.description()) ? d.description() : g.description(), image,
                    members.stream().mapToInt(MenuDish::spicyLevel).max().orElse(0), allergens, variants,
                    members.stream().allMatch(MenuDish::soldOut)));
            } else {
                all.add(new Item(d.id(), d.name(), d.categoryId(), d.price(), false, d.description(), d.image(), d.spicyLevel(),
                    d.allergens(), List.of(), d.soldOut()));
            }
        }

        Set<String> usedCats = new HashSet<>(all.stream().map(Item::categoryId).toList());
        List<Category> categories = menu.categories().stream()
            .filter(c -> usedCats.contains(c.id()))
            .map(c -> new Category(c.id(), c.name(), c.image()))
            .toList();
        Map<String, String> catNames = new LinkedHashMap<>();
        categories.forEach(c -> catNames.put(c.id(), c.name()));

        List<SetMenu> sets = menu.sets().stream()
            .map(s -> new SetMenu(s.id(), s.name(), Vi.trim(s.description()), s.image(), s.price(), s.originalPrice(),
                s.sellFrom(), s.sellTo(), s.items().stream().map(i -> (i.qty() > 1 ? i.qty() + " × " : "") + i.name()).toList()))
            .toList();

        // Nổi bật: món bán chạy (đang hiện trên website), thiếu thì bù món có ảnh.
        Set<String> visibleIds = new HashSet<>(all.stream().map(Item::id).toList());
        List<String> featured = new ArrayList<>();
        for (String id : menu.bestSellers()) {
            if (featured.size() >= FEATURED_LIMIT) break;
            if (visibleIds.contains(id) && !featured.contains(id)) featured.add(id);
        }
        for (Item i : all) {
            if (featured.size() >= FEATURED_LIMIT) break;
            if (i.image() != null && !i.soldOut() && !featured.contains(i.id())) featured.add(i.id());
        }

        String k = Vi.trim(keyword);
        String cat = Vi.trim(categoryId);
        boolean onlySets = "set".equals(cat);
        List<Item> items = onlySets ? List.of() : all.stream()
            .filter(i -> cat.isEmpty() || cat.equals(i.categoryId()))
            .filter(i -> k.isEmpty() || Vi.matches(i.name(), k) || Vi.matches(i.description(), k)
                || Vi.matches(catNames.get(i.categoryId()), k) || i.variants().stream().anyMatch(v -> Vi.matches(v, k)))
            .toList();
        List<SetMenu> matchedSets = !cat.isEmpty() && !onlySets ? List.of() : sets.stream()
            .filter(s -> k.isEmpty() || Vi.matches(s.name(), k) || Vi.matches(s.description(), k)
                || s.items().stream().anyMatch(x -> Vi.matches(x, k)))
            .toList();
        return new PublicMenu(categories, items, matchedSets, featured, all.size());
    }

    /* ------------------------------------------------------------ Album */

    public List<GalleryPhoto> gallery() {
        return jdbc.sql("SELECT id, image_url, caption FROM gallery_photos WHERE is_visible = 1 ORDER BY sort_order, id")
            .query((rs, n) -> new GalleryPhoto(Ids.str(rs.getLong("id")), images.url(rs.getString("image_url")),
                Vi.trim(rs.getString("caption"))))
            .list();
    }
}
