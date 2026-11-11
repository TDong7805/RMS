package com.rms.storage;

import com.rms.common.ValidationException;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Base64;
import java.util.Iterator;
import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;

/**
 * Kiểm tra và chuẩn hóa ảnh tải lên.
 *
 *  - Chỉ nhận JPG / PNG / WebP, nhận diện bằng nội dung file (chữ ký đầu file), không tin đuôi file hay khai báo
 *    của trình duyệt.
 *  - Tối đa {@link #MAX_BYTES} (khớp giao diện: "tối đa 2 MB"), tối đa {@link #MAX_PIXELS} điểm ảnh (chặn ảnh
 *    "bom giải nén" làm tràn bộ nhớ).
 *  - Giải mã rồi LƯU LẠI thành file mới: thu nhỏ cạnh dài nhất về {@link #MAX_SIDE}px, bỏ toàn bộ dữ liệu ẩn (vị trí
 *    GPS, nội dung lạ chèn vào file). Ảnh có nền trong suốt lưu PNG, còn lại lưu JPG.
 *
 * Ảnh gửi lên dạng data URL ("data:image/jpeg;base64,...") trong JSON của form, vì form món ăn vốn gửi JSON và
 * ảnh đã giới hạn 2 MB. Giao diện đã xoay ảnh đúng chiều theo EXIF trước khi gửi (canvas của trình duyệt).
 */
public final class ImageProcessor {
    public static final int MAX_BYTES = 2 * 1024 * 1024;
    static final long MAX_PIXELS = 40_000_000L;
    static final int MAX_SIDE = 1200;
    private static final float JPEG_QUALITY = 0.85f;

    public record Image(byte[] content, String extension) {}

    static {
        // Spring Boot chạy từ file jar: nạp plugin đọc WebP (TwelveMonkeys) nằm trong jar con.
        ImageIO.scanForPlugins();
    }

    private ImageProcessor() {}

    /** Data URL → ảnh đã chuẩn hóa. Lỗi → ValidationException cho trường {@code field}. */
    public static Image fromDataUrl(String dataUrl, String field) {
        int comma = dataUrl == null ? -1 : dataUrl.indexOf(',');
        if (comma < 0 || !dataUrl.startsWith("data:") || !dataUrl.substring(0, comma).endsWith(";base64")) {
            throw new ValidationException(field, "Ảnh không hợp lệ, vui lòng chọn lại");
        }
        // base64 dài hơn dữ liệu thật ~4/3: chặn sớm trước khi giải mã.
        if ((long) (dataUrl.length() - comma - 1) * 3 / 4 > MAX_BYTES + 3) {
            throw new ValidationException(field, "Ảnh tối đa 2 MB");
        }
        byte[] bytes;
        try {
            bytes = Base64.getMimeDecoder().decode(dataUrl.substring(comma + 1));
        } catch (IllegalArgumentException e) {
            throw new ValidationException(field, "Ảnh không hợp lệ, vui lòng chọn lại");
        }
        return process(bytes, field);
    }

    static Image process(byte[] bytes, String field) {
        if (bytes.length > MAX_BYTES) throw new ValidationException(field, "Ảnh tối đa 2 MB");
        if (!isJpeg(bytes) && !isPng(bytes) && !isWebp(bytes)) {
            throw new ValidationException(field, "Chỉ nhận ảnh JPG, PNG hoặc WebP");
        }
        BufferedImage source = decode(bytes, field);
        BufferedImage resized = resize(source);
        boolean alpha = resized.getColorModel().hasAlpha() && hasTransparentPixel(resized);
        try {
            return alpha ? new Image(writePng(resized), "png") : new Image(writeJpeg(toRgb(resized)), "jpg");
        } catch (IOException e) {
            throw new ValidationException(field, "Không xử lý được ảnh, vui lòng chọn ảnh khác");
        }
    }

    private static BufferedImage decode(byte[] bytes, String field) {
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            Iterator<ImageReader> readers = in == null ? null : ImageIO.getImageReaders(in);
            if (readers == null || !readers.hasNext()) throw new ValidationException(field, "Không đọc được ảnh, file có thể bị hỏng");
            ImageReader reader = readers.next();
            try {
                reader.setInput(in, true, true);
                long pixels = (long) reader.getWidth(0) * reader.getHeight(0);
                if (pixels > MAX_PIXELS) throw new ValidationException(field, "Ảnh có kích thước quá lớn");
                BufferedImage image = reader.read(0);
                if (image == null) throw new ValidationException(field, "Không đọc được ảnh, file có thể bị hỏng");
                return image;
            } finally {
                reader.dispose();
            }
        } catch (IOException | RuntimeException e) {
            if (e instanceof ValidationException v) throw v;
            throw new ValidationException(field, "Không đọc được ảnh, file có thể bị hỏng");
        }
    }

    private static BufferedImage resize(BufferedImage src) {
        int w = src.getWidth(), h = src.getHeight();
        double scale = Math.min(1.0, (double) MAX_SIDE / Math.max(w, h));
        int tw = Math.max(1, (int) Math.round(w * scale)), th = Math.max(1, (int) Math.round(h * scale));
        boolean alpha = src.getColorModel().hasAlpha();
        BufferedImage out = new BufferedImage(tw, th, alpha ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.drawImage(src, 0, 0, tw, th, null);
        } finally {
            g.dispose();
        }
        return out;
    }

    private static boolean hasTransparentPixel(BufferedImage img) {
        for (int y = 0; y < img.getHeight(); y += 2)
            for (int x = 0; x < img.getWidth(); x += 2)
                if ((img.getRGB(x, y) >>> 24) < 255) return true;
        return false;
    }

    private static BufferedImage toRgb(BufferedImage img) {
        if (img.getType() == BufferedImage.TYPE_INT_RGB) return img;
        BufferedImage rgb = new BufferedImage(img.getWidth(), img.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = rgb.createGraphics();
        try {
            g.setColor(java.awt.Color.WHITE); // nền trắng cho phần bán trong suốt
            g.fillRect(0, 0, img.getWidth(), img.getHeight());
            g.drawImage(img, 0, 0, null);
        } finally {
            g.dispose();
        }
        return rgb;
    }

    private static byte[] writeJpeg(BufferedImage img) throws IOException {
        ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ImageOutputStream out = ImageIO.createImageOutputStream(bytes)) {
            writer.setOutput(out);
            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(JPEG_QUALITY);
            writer.write(null, new IIOImage(img, null, null), param);
        } finally {
            writer.dispose();
        }
        return bytes.toByteArray();
    }

    private static byte[] writePng(BufferedImage img) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        if (!ImageIO.write(img, "png", bytes)) throw new IOException("Không có bộ ghi PNG");
        return bytes.toByteArray();
    }

    private static boolean isJpeg(byte[] b) {
        return b.length > 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF;
    }

    private static boolean isPng(byte[] b) {
        return b.length > 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G';
    }

    private static boolean isWebp(byte[] b) {
        return b.length > 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
            && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P';
    }
}
