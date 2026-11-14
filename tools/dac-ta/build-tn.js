const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType,
  BorderStyle, AlignmentType, HeadingLevel, LevelFormat, PageNumber, Footer, Header, TableLayoutType,
  ImageRun, PageOrientation,
} = require('docx');
const { ACTORS, RULES_TABLE, MENU_POS, GROUPS, BUSINESS_RULES, STATES_NOTE, T_HEAD, T_W, STATE_TABLES, OUT_OF_SCOPE, UCS } = require('./content-tn');
const FONT = 'Times New Roman';
const SIZE = 26; // 13pt
const SMALL = 24; // 12pt trong bảng con
const PAGE_W = 11906, MARGIN = 1134, CONTENT_W = PAGE_W - 2 * MARGIN; // 9638
const LABEL_W = 2200, VALUE_W = CONTENT_W - LABEL_W; // 7438
const GREY = 'E7E6E6', HEAD = 'D9E2F3', GROUP_FILL = 'EEF3FA';
const border = { style: BorderStyle.SINGLE, size: 4, color: '808080' };
const borders = { top: border, bottom: border, left: border, right: border };
// **đậm**, *nghiêng*
function runs(text, size = SIZE, baseBold = false) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), font: FONT, size, bold: baseBold }));
    const t = m[0];
    if (t.startsWith('**')) out.push(new TextRun({ text: t.slice(2, -2), font: FONT, size, bold: true }));
    else out.push(new TextRun({ text: t.slice(1, -1), font: FONT, size, italics: true, bold: baseBold }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), font: FONT, size, bold: baseBold }));
  return out;
}

function para(line, size = SIZE) {
  const spacing = { before: 30, after: 30, line: 276 };
  if (line.startsWith('  • ')) return new Paragraph({ numbering: { reference: 'bullets', level: 1 }, spacing, children: runs(line.slice(4), size) });
  if (line.startsWith('• ')) return new Paragraph({ numbering: { reference: 'bullets', level: 0 }, spacing, children: runs(line.slice(2), size) });
  if (line.startsWith('> ')) return new Paragraph({ indent: { left: 360 }, spacing, children: runs(line.slice(2), size) });
  return new Paragraph({ spacing, children: runs(line, size) });
}

function cell(children, width, opts = {}) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    columnSpan: opts.span,
    children,
  });
}

function table(widths, rows) {
  return new Table({ width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED, rows });
}

function headRow(head, widths, size = SMALL) {
  return new TableRow({ tableHeader: true, children: head.map((h, i) => cell([new Paragraph({ children: runs(h, size, true) })], widths[i], { fill: HEAD })) });
}

// Bảng con trong ô (dữ liệu vào / ra).
function subTable({ widths, head, rows }) {
  const trs = [];
  if (head) trs.push(headRow(head, widths));
  for (const r of rows) trs.push(new TableRow({ children: r.map((c, i) => cell([para(c, SMALL)], widths[i])) }));
  return table(widths, trs);
}

// Bảng thông tin toàn trang: cột đầu in đậm, nền xám.
function infoTable({ widths, head, rows }) {
  const trs = [headRow(head, widths, SIZE)];
  for (const r of rows) trs.push(new TableRow({ children: r.map((c, i) => (i === 0
    ? cell([new Paragraph({ children: runs(c, SIZE, true) })], widths[i], { fill: GREY })
    : cell([para(c)], widths[i]))) }));
  return table(widths, trs);
}

function valueChildren(v) {
  if (v == null || (Array.isArray(v) && v.length === 0)) return [para('Không có.')];
  if (typeof v === 'string') return [para(v)];
  if (Array.isArray(v)) return v.map((x) => para(x));
  if (v.widths) return [subTable(v), new Paragraph({ spacing: { after: 0 }, children: [] })];
  return [para(String(v))];
}

// ---------------------------------------------------------------- Phần riêng của đặc tả Đặt món – Bếp – Thu ngân
const ALL = new Map(UCS.map((u) => [u.id, u]));
for (const g of GROUPS) for (const id of g.ids) if (!ALL.has(id)) throw new Error('Thiếu UC ' + id);
if (ALL.size !== GROUPS.reduce((n, g) => n + g.ids.length, 0)) throw new Error('Số UC không khớp nhóm');

function ucTable(uc) {
  const rows = [];
  const add = (label, value) => rows.push(new TableRow({ children: [
    cell([new Paragraph({ children: runs(label, SIZE, true) })], LABEL_W, { fill: GREY }),
    cell(valueChildren(value), VALUE_W),
  ] }));
  rows.push(new TableRow({ tableHeader: true, children: [cell([new Paragraph({ alignment: AlignmentType.CENTER, children: runs('Use Case Description', SIZE, true) })], CONTENT_W, { fill: HEAD, span: 2 })] }));
  add('Use Case ID', uc.id);
  add('Tên', uc.name);
  add('Tác nhân chính', uc.actor);
  if (uc.secondary) add('Tác nhân phụ', uc.secondary);
  add('Mô tả', uc.desc);
  add('Tiền điều kiện', uc.pre);
  add('Hậu điều kiện', uc.post);
  add('Dữ liệu đầu vào', uc.input || uc.inputText);
  add('Dữ liệu đầu ra', uc.output || uc.outputText);
  add('Luồng sự kiện chính', uc.main);
  add('Luồng sự kiện phụ', uc.alt);
  add('Luồng ngoại lệ', uc.exc);
  add('Quy tắc nghiệp vụ', uc.rules);
  add('Phát triển sau', uc.future);
  return table([LABEL_W, VALUE_W], rows);
}

function indexTable() {
  const widths = [1550, 3550, 1700, 2838];
  const rows = [headRow(['Mã', 'Tên Use Case', 'Tác nhân chính', 'Vị trí'], widths, SIZE)];
  for (const g of GROUPS) {
    rows.push(new TableRow({ children: [cell([new Paragraph({ children: runs(g.title, SIZE, true) })], CONTENT_W, { fill: GROUP_FILL, span: 4 })] }));
    for (const id of g.ids) {
      const uc = ALL.get(id);
      rows.push(new TableRow({ children: [
        cell([para(id, SMALL)], widths[0]),
        cell([para(uc.name, SMALL)], widths[1]),
        cell([para(uc.actor, SMALL)], widths[2]),
        cell([para(MENU_POS[id], SMALL)], widths[3]),
      ] }));
    }
  }
  return table(widths, rows);
}

const RELATED = {
  widths: [2400, 7238],
  head: ['Phân hệ', 'Liên quan'],
  rows: [
    ['Quản lý nhà hàng', '**Dashboard** (doanh thu, số đơn, món bán chạy / bán chậm) đọc từ hóa đơn đã thanh toán và món trong đơn. **Khu vực bàn**: in mã QR của bàn; sơ đồ bàn của Thu ngân dùng cùng vị trí. **Món ăn**: thực đơn của khách lấy món / combo / danh mục đang bán. **Tài khoản**: lương theo giờ, lương cơ bản dùng cho tính lương. **Cấu hình hệ thống**: cần bổ sung mục **tài khoản nhận tiền** (ngân hàng, số tài khoản, chủ tài khoản) để tạo mã QR chuyển khoản; giờ mở cửa dùng cho UC-KH-01.'],
    ['Quản lý kho', 'Bếp xem tồn kho (chỉ đọc, UC-BEP-06). Công thức định lượng do Bếp khai báo (UC-BEP-07) hiển thị ở chi tiết nguyên liệu của kho. Phiên bản này không tự trừ kho khi bán món; bếp lĩnh nguyên liệu qua phiếu xuất kho.'],
    ['Thông báo', 'Dùng chung cơ chế thông báo của hệ thống (chuông ở đầu trang, giữ 30 ngày, trạng thái đọc riêng từng tài khoản).'],
  ],
};

const H1 = (text, pageBreakBefore = false) => new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore, children: [new TextRun({ text, font: FONT })] });
const H2 = (text, pageBreakBefore = false) => new Paragraph({ heading: HeadingLevel.HEADING_2, pageBreakBefore, children: [new TextRun({ text, font: FONT })] });
const P = (text, opts = {}) => new Paragraph({ spacing: { after: 120, line: 300 }, alignment: opts.align, children: runs(text) });
const GAP = () => new Paragraph({ spacing: { after: 60 }, children: [] });

const children = [
  new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ĐẶC TẢ USE CASE – ĐẶT MÓN, BẾP, THU NGÂN', font: FONT })] }),
  P('Hệ thống quản lý nhà hàng · Nhóm 2 · Cập nhật 14/11/2026 (đã khớp code đợt 1)', { align: AlignmentType.CENTER }),

  H1('1. Giới thiệu'),
  P(`Tài liệu đặc tả **${ALL.size} Use Case** của ba phân hệ còn lại: **Đặt món** cho khách tại bàn (quét mã QR, UC-KH), **Nhân viên bếp** (UC-BEP) và **Thu ngân** (UC-TN).`),
  P('Website khách hàng (thực đơn, tin tức, đặt bàn trực tuyến) được tách thành một dự án riêng nên không nằm trong tài liệu này. AI tư vấn món sẽ được bổ sung sau.'),
  P('Mỗi Use Case trình bày theo khung "Use Case Description" của nhóm. Các mục 4–7 là quy ước, quy tắc và trạng thái dùng chung; đặc tả từng Use Case không nhắc lại.'),

  H1('2. Tác nhân'),
  infoTable(ACTORS),
  GAP(),

  H1('3. Danh sách Use Case'),
  indexTable(),

  H1('4. Quy ước chung (giao diện và dữ liệu)', true),
  infoTable({ widths: RULES_TABLE.widths, head: ['Mục', 'Quy ước'], rows: RULES_TABLE.rows }),

  H1('5. Quy tắc nghiệp vụ chung', true),
  infoTable(BUSINESS_RULES),
  GAP(),

  H1('6. Trạng thái', true),
  ...STATES_NOTE.map((l) => para(l)),
  ...STATE_TABLES.flatMap((t, i) => [
    H2(`6.${i + 1}. ${t.title}`),
    infoTable({ widths: t.widths || T_W, head: t.head || T_HEAD, rows: t.rows }),
    GAP(),
  ]),

  H1('7. Liên quan đến các phân hệ khác', true),
  infoTable(RELATED),
];

let sec = 8;
for (const g of GROUPS) {
  children.push(H1(`${sec}. ${g.title}`, true));
  g.ids.forEach((id, i) => {
    const uc = ALL.get(id);
    children.push(H2(`${uc.id} – ${uc.name}`, i > 0));
    children.push(ucTable(uc));
  });
  sec += 1;
}
children.push(H1(`${sec}. Ngoài phạm vi (phát triển sau)`, true));
children.push(P('Các chức năng sau không thuộc phiên bản này; từng Use Case có ghi thêm ở dòng "Phát triển sau".'));
for (const line of OUT_OF_SCOPE) children.push(para(line));

const header = new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Đặc tả Use Case – Đặt món, Bếp, Thu ngân', font: FONT, size: 20, italics: true, color: '808080' })] })] });
const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 })] })] });

const doc = new Document({
  creator: 'Nhóm 2',
  title: 'Đặc tả Use Case – Đặt món, Bếp, Thu ngân',
  styles: {
    default: { document: { run: { font: FONT, size: SIZE } } },
    paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: 36, bold: true, color: '1F3864' }, paragraph: { spacing: { before: 0, after: 120 }, keepNext: true } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 30, bold: true, color: '1F3864' }, paragraph: { spacing: { before: 240, after: 160 }, keepNext: true, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 27, bold: true, color: '2F5496' }, paragraph: { spacing: { before: 200, after: 120 }, keepNext: true, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [{ reference: 'bullets', levels: [
    { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } },
    { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 240 } } } },
  ] }] },
  sections: [{
    properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
    headers: { default: header },
    footers: { default: footer },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(process.argv[2], buf);
  console.log('OK', buf.length, 'UC:', ALL.size);
});
