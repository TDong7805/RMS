package com.rms.common;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Danh sách IP / dải mạng dạng "113.161.1.20, 192.168.1.0/24, 2001:db8::/32" — dùng kiểm tra "đang dùng WiFi quán".
 * Chỉ nhận địa chỉ số (không phân giải tên miền).
 */
public final class IpNetworks {
    private IpNetworks() {}

    private static final Pattern NUMERIC = Pattern.compile("^[0-9a-fA-F:.]+$");

    public record Network(byte[] address, int prefix, String text) {}

    /** Tách và kiểm tra danh sách; mục sai định dạng → ValidationException(field). */
    public static List<Network> parse(String list, String field) {
        List<Network> out = new ArrayList<>();
        if (list == null) return out;
        for (String raw : list.split("[,;\\s]+")) {
            String item = raw.trim();
            if (item.isEmpty()) continue;
            Network n = parseOne(item);
            if (n == null) throw new ValidationException(field, "\"" + item + "\" không phải IP hoặc dải mạng hợp lệ (vd. 192.168.1.0/24)");
            out.add(n);
        }
        return out;
    }

    /** Như parse nhưng bỏ qua mục sai (dữ liệu cũ trong CSDL). */
    public static List<Network> parseLenient(String list) {
        List<Network> out = new ArrayList<>();
        if (list == null) return out;
        for (String raw : list.split("[,;\\s]+")) {
            Network n = raw.isBlank() ? null : parseOne(raw.trim());
            if (n != null) out.add(n);
        }
        return out;
    }

    static Network parseOne(String item) {
        String addr = item;
        Integer prefix = null;
        int slash = item.indexOf('/');
        if (slash >= 0) {
            addr = item.substring(0, slash);
            try {
                prefix = Integer.parseInt(item.substring(slash + 1));
            } catch (NumberFormatException e) {
                return null;
            }
        }
        byte[] bytes = bytes(addr);
        if (bytes == null) return null;
        int max = bytes.length * 8;
        if (prefix == null) prefix = max;
        if (prefix < 0 || prefix > max) return null;
        return new Network(bytes, prefix, item);
    }

    /** IP dạng số → byte (IPv4 4 byte, IPv6 16 byte; IPv4-mapped IPv6 → 4 byte). Sai → null. */
    static byte[] bytes(String ip) {
        if (ip == null || ip.isBlank() || !NUMERIC.matcher(ip).matches()) return null;
        if (!ip.contains(":") && ip.split("\\.", -1).length != 4) return null;
        try {
            byte[] b = InetAddress.getByName(ip).getAddress();
            if (b.length == 16 && isMappedV4(b)) return new byte[] {b[12], b[13], b[14], b[15]};
            return b;
        } catch (UnknownHostException e) {
            return null;
        }
    }

    private static boolean isMappedV4(byte[] b) {
        for (int i = 0; i < 10; i++) if (b[i] != 0) return false;
        return b[10] == (byte) 0xff && b[11] == (byte) 0xff;
    }

    public static boolean matches(String ip, List<Network> networks) {
        byte[] a = bytes(ip);
        if (a == null) return false;
        for (Network n : networks) {
            if (n.address().length != a.length) continue;
            int bits = n.prefix();
            boolean ok = true;
            for (int i = 0; i < a.length && bits > 0 && ok; i++, bits -= 8) {
                int mask = bits >= 8 ? 0xff : (0xff << (8 - bits)) & 0xff;
                ok = (a[i] & mask) == (n.address()[i] & mask);
            }
            if (ok) return true;
        }
        return false;
    }
}
