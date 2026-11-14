# Nguồn sinh file đặc tả Word

- `content-tn.js`: nội dung đặc tả Đặt món – Bếp – Thu ngân (sửa ở đây khi chức năng thay đổi).
- `build-tn.js`: dựng file Word.

Chạy (cần Node và gói `docx`):

```bash
cd tools/dac-ta
npm install docx@9
node build-tn.js ../../DacTa_UC_DatMon_Bep_ThuNgan.docx
```
