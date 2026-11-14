package com.rms.ordering;

import java.nio.charset.StandardCharsets;
import java.text.Normalizer;

/**
 * Tạo nội dung mã QR chuyển khoản theo chuẩn VietQR (EMVCo – Napas 247). Mọi ứng dụng ngân hàng tại Việt Nam
 * quét được, tự điền số tài khoản, số tiền, nội dung. Tạo ngay trên máy chủ, không gọi dịch vụ ngoài.
 */
public final class VietQr {
    private VietQr() {}

    private static String tlv(String id, String value) {
        return id + String.format("%02d", value.length()) + value;
    }

    /** Bỏ dấu, chỉ giữ chữ / số / khoảng trắng (nội dung chuyển khoản không nhận ký tự đặc biệt). */
    static String plain(String s, int max) {
        String t = Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "")
            .replace('đ', 'd').replace('Đ', 'D').replaceAll("[^A-Za-z0-9 ]", " ").replaceAll("\\s+", " ").trim();
        return t.length() > max ? t.substring(0, max) : t;
    }

    /**
     * @param bankBin   mã ngân hàng Napas (vd. 970436 Vietcombank)
     * @param accountNo số tài khoản
     * @param amount    số tiền (đồng), > 0
     * @param info      nội dung chuyển khoản (vd. mã hóa đơn)
     */
    public static String payload(String bankBin, String accountNo, long amount, String info) {
        String beneficiary = tlv("00", bankBin) + tlv("01", accountNo);
        String merchant = tlv("00", "A000000727") + tlv("01", beneficiary) + tlv("02", "QRIBFTTA");
        StringBuilder sb = new StringBuilder()
            .append(tlv("00", "01"))
            .append(tlv("01", "12"))                    // 12 = mã dùng một lần (có số tiền)
            .append(tlv("38", merchant))
            .append(tlv("53", "704"))                   // VND
            .append(tlv("54", Long.toString(amount)))
            .append(tlv("58", "VN"));
        String note = plain(info, 25);
        if (!note.isEmpty()) sb.append(tlv("62", tlv("08", note)));
        sb.append("6304");
        return sb + crc16(sb.toString());
    }

    /** CRC-16/CCITT-FALSE (đa thức 0x1021, giá trị đầu 0xFFFF) theo chuẩn EMVCo. */
    static String crc16(String data) {
        int crc = 0xFFFF;
        for (byte b : data.getBytes(StandardCharsets.UTF_8)) {
            crc ^= (b & 0xFF) << 8;
            for (int i = 0; i < 8; i++) {
                crc = (crc & 0x8000) != 0 ? (crc << 1) ^ 0x1021 : crc << 1;
                crc &= 0xFFFF;
            }
        }
        return String.format("%04X", crc);
    }
}
