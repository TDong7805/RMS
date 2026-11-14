package com.rms.payroll;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;
import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamException;
import javax.xml.stream.XMLStreamReader;

/**
 * Đọc / ghi bảng tính đơn giản, không cần thư viện ngoài:
 * - Đọc trang tính đầu tiên của file .xlsx (zip + XML) hoặc file .csv (UTF-8, dấu phẩy hoặc chấm phẩy).
 * - Ghi file .xlsx một trang (chữ thường, dòng đầu in đậm) cho file mẫu và file các dòng lỗi.
 * Ô số trong .xlsx trả về nguyên dạng số (ngày / giờ của Excel là số seri — bên gọi tự diễn giải).
 */
public final class SheetIO {
    private SheetIO() {}

    /** Giới hạn dung lượng giải nén để chống file nén "bom". */
    private static final long MAX_UNZIPPED = 30L * 1024 * 1024;

    public static class BadFileException extends Exception {
        public BadFileException(String message) {
            super(message);
        }
    }

    /* ------------------------------------------------------------------ Đọc */

    public static List<List<String>> read(String fileName, byte[] data) throws BadFileException {
        String name = fileName == null ? "" : fileName.toLowerCase();
        if (name.endsWith(".csv")) return readCsv(data);
        if (name.endsWith(".xlsx")) return readXlsx(data);
        throw new BadFileException("Chỉ nhận file .xlsx hoặc .csv");
    }

    static List<List<String>> readCsv(byte[] data) {
        String text = new String(data, StandardCharsets.UTF_8);
        if (text.startsWith("﻿")) text = text.substring(1);
        String firstLine = text.lines().findFirst().orElse("");
        char sep = firstLine.chars().filter(c -> c == ';').count() > firstLine.chars().filter(c -> c == ',').count() ? ';' : ',';
        List<List<String>> rows = new ArrayList<>();
        List<String> row = new ArrayList<>();
        StringBuilder cell = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (quoted) {
                if (c == '"') {
                    if (i + 1 < text.length() && text.charAt(i + 1) == '"') {
                        cell.append('"');
                        i++;
                    } else {
                        quoted = false;
                    }
                } else {
                    cell.append(c);
                }
            } else if (c == '"') {
                quoted = true;
            } else if (c == sep) {
                row.add(cell.toString());
                cell.setLength(0);
            } else if (c == '\n' || c == '\r') {
                if (c == '\r' && i + 1 < text.length() && text.charAt(i + 1) == '\n') i++;
                row.add(cell.toString());
                cell.setLength(0);
                rows.add(row);
                row = new ArrayList<>();
            } else {
                cell.append(c);
            }
        }
        if (cell.length() > 0 || !row.isEmpty()) {
            row.add(cell.toString());
            rows.add(row);
        }
        return rows;
    }

    static List<List<String>> readXlsx(byte[] data) throws BadFileException {
        Map<String, byte[]> parts = new HashMap<>();
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(data))) {
            long total = 0;
            ZipEntry e;
            while ((e = zip.getNextEntry()) != null) {
                String n = e.getName();
                boolean wanted = n.equals("xl/sharedStrings.xml") || (n.startsWith("xl/worksheets/") && n.endsWith(".xml") && !n.contains("/_rels/"));
                if (!wanted) continue;
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[8192];
                int r;
                while ((r = zip.read(buf)) > 0) {
                    total += r;
                    if (total > MAX_UNZIPPED) throw new BadFileException("File quá lớn");
                    out.write(buf, 0, r);
                }
                parts.put(n, out.toByteArray());
            }
        } catch (IOException ex) {
            throw new BadFileException("Không đọc được file Excel");
        }
        // Trang tính đầu tiên: sheet1.xml, nếu không có thì file trang tính có tên nhỏ nhất.
        String sheet = parts.containsKey("xl/worksheets/sheet1.xml") ? "xl/worksheets/sheet1.xml"
            : parts.keySet().stream().filter(k -> k.startsWith("xl/worksheets/")).sorted().findFirst().orElse(null);
        if (sheet == null) throw new BadFileException("File Excel không có trang tính");
        try {
            List<String> shared = parts.containsKey("xl/sharedStrings.xml") ? sharedStrings(parts.get("xl/sharedStrings.xml")) : List.of();
            return sheetRows(parts.get(sheet), shared);
        } catch (XMLStreamException | RuntimeException ex) {
            throw new BadFileException("Không đọc được file Excel");
        }
    }

    private static XMLStreamReader xml(byte[] data) throws XMLStreamException {
        XMLInputFactory f = XMLInputFactory.newFactory();
        f.setProperty(XMLInputFactory.SUPPORT_DTD, false);
        f.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false);
        return f.createXMLStreamReader(new ByteArrayInputStream(data));
    }

    private static List<String> sharedStrings(byte[] data) throws XMLStreamException {
        List<String> out = new ArrayList<>();
        XMLStreamReader r = xml(data);
        StringBuilder cur = null;
        boolean inT = false;
        boolean inRph = false;
        while (r.hasNext()) {
            int ev = r.next();
            if (ev == XMLStreamConstants.START_ELEMENT) {
                switch (r.getLocalName()) {
                    case "si" -> cur = new StringBuilder();
                    case "t" -> inT = !inRph;
                    case "rPh" -> inRph = true;
                    default -> { }
                }
            } else if (ev == XMLStreamConstants.CHARACTERS && inT && cur != null) {
                cur.append(r.getText());
            } else if (ev == XMLStreamConstants.END_ELEMENT) {
                switch (r.getLocalName()) {
                    case "si" -> {
                        out.add(cur == null ? "" : cur.toString());
                        cur = null;
                    }
                    case "t" -> inT = false;
                    case "rPh" -> inRph = false;
                    default -> { }
                }
            }
        }
        return out;
    }

    private static int colIndex(String ref) {
        int col = 0;
        for (char ch : ref.toCharArray()) {
            if (!Character.isLetter(ch)) break;
            col = col * 26 + (Character.toUpperCase(ch) - 'A' + 1);
        }
        return col - 1;
    }

    private static List<List<String>> sheetRows(byte[] data, List<String> shared) throws XMLStreamException {
        TreeMap<Integer, TreeMap<Integer, String>> rows = new TreeMap<>();
        XMLStreamReader r = xml(data);
        int rowNo = 0;
        int nextCol = 0;
        int col = 0;
        String type = null;
        StringBuilder val = null;
        boolean inValue = false;
        while (r.hasNext()) {
            int ev = r.next();
            if (ev == XMLStreamConstants.START_ELEMENT) {
                String n = r.getLocalName();
                if (n.equals("row")) {
                    String rr = r.getAttributeValue(null, "r");
                    rowNo = rr != null ? Integer.parseInt(rr) : rowNo + 1;
                    nextCol = 0;
                } else if (n.equals("c")) {
                    String ref = r.getAttributeValue(null, "r");
                    col = ref != null ? colIndex(ref) : nextCol;
                    nextCol = col + 1;
                    type = r.getAttributeValue(null, "t");
                    val = new StringBuilder();
                } else if ((n.equals("v") || n.equals("t")) && val != null) {
                    inValue = true;
                }
            } else if (ev == XMLStreamConstants.CHARACTERS && inValue && val != null) {
                val.append(r.getText());
            } else if (ev == XMLStreamConstants.END_ELEMENT) {
                String n = r.getLocalName();
                if (n.equals("v") || n.equals("t")) {
                    inValue = false;
                } else if (n.equals("c") && val != null) {
                    String v = val.toString();
                    if ("s".equals(type)) {
                        int idx = v.isBlank() ? -1 : Integer.parseInt(v.trim());
                        v = idx >= 0 && idx < shared.size() ? shared.get(idx) : "";
                    } else if ("b".equals(type)) {
                        v = "1".equals(v) ? "TRUE" : "FALSE";
                    }
                    rows.computeIfAbsent(rowNo, k -> new TreeMap<>()).put(col, v);
                    val = null;
                }
            }
        }
        List<List<String>> out = new ArrayList<>();
        int last = rows.isEmpty() ? 0 : rows.lastKey();
        for (int i = 1; i <= last; i++) {
            TreeMap<Integer, String> cells = rows.get(i);
            List<String> row = new ArrayList<>();
            if (cells != null) {
                int width = cells.lastKey() + 1;
                for (int c = 0; c < width; c++) row.add(cells.getOrDefault(c, ""));
            }
            out.add(row);
        }
        return out;
    }

    /* ------------------------------------------------------------------ Ghi */

    private static String esc(String s) {
        StringBuilder b = new StringBuilder();
        for (char c : (s == null ? "" : s).toCharArray()) {
            switch (c) {
                case '&' -> b.append("&amp;");
                case '<' -> b.append("&lt;");
                case '>' -> b.append("&gt;");
                case '"' -> b.append("&quot;");
                default -> {
                    if (c >= 0x20 || c == '\t' || c == '\n') b.append(c);
                }
            }
        }
        return b.toString();
    }

    private static String colName(int i) {
        StringBuilder s = new StringBuilder();
        for (int n = i + 1; n > 0; n = (n - 1) / 26) s.insert(0, (char) ('A' + (n - 1) % 26));
        return s.toString();
    }

    /** File .xlsx một trang tên {@code sheetName}; dòng đầu (tiêu đề) in đậm, mọi ô là chữ. */
    public static byte[] writeXlsx(String sheetName, List<List<String>> rows, int[] widths) {
        StringBuilder sheet = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>")
            .append("<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">");
        if (widths != null && widths.length > 0) {
            sheet.append("<cols>");
            for (int i = 0; i < widths.length; i++) {
                sheet.append("<col min=\"").append(i + 1).append("\" max=\"").append(i + 1).append("\" width=\"").append(widths[i])
                    .append("\" customWidth=\"1\"/>");
            }
            sheet.append("</cols>");
        }
        sheet.append("<sheetData>");
        for (int r = 0; r < rows.size(); r++) {
            sheet.append("<row r=\"").append(r + 1).append("\">");
            List<String> row = rows.get(r);
            for (int c = 0; c < row.size(); c++) {
                sheet.append("<c r=\"").append(colName(c)).append(r + 1).append("\" t=\"inlineStr\"").append(r == 0 ? " s=\"1\"" : "")
                    .append("><is><t xml:space=\"preserve\">").append(esc(row.get(c))).append("</t></is></c>");
            }
            sheet.append("</row>");
        }
        sheet.append("</sheetData></worksheet>");

        Map<String, String> files = new java.util.LinkedHashMap<>();
        files.put("[Content_Types].xml", """
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
            <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
            <Default Extension="xml" ContentType="application/xml"/>
            <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
            <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
            <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
            </Types>""");
        files.put("_rels/.rels", """
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
            </Relationships>""");
        files.put("xl/workbook.xml", """
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
            <sheets><sheet name="%s" sheetId="1" r:id="rId1"/></sheets></workbook>""".formatted(esc(sheetName)));
        files.put("xl/_rels/workbook.xml.rels", """
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
            <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
            </Relationships>""");
        files.put("xl/styles.xml", """
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
            <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
            <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
            <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
            <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
            <cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
            </styleSheet>""");
        files.put("xl/worksheets/sheet1.xml", sheet.toString());

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out)) {
            for (var f : files.entrySet()) {
                zip.putNextEntry(new ZipEntry(f.getKey()));
                zip.write(f.getValue().strip().getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
        return out.toByteArray();
    }
}
