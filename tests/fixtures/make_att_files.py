"""Tạo file chấm công thử nghiệm (giống file Excel thật: ô ngày / giờ kiểu số, chuỗi dùng chung)."""
import sys, datetime as dt
sys.path.insert(0, r"C:/Users/ACER/AppData/Local/Temp/claude/4ae8965a2b05c1b3/6d8f18e6-33fe-4202-a172-019f566d184a/scratchpad/xlsx-venv")
from openpyxl import Workbook

out = sys.argv[1]
wb = Workbook()
ws = wb.active
ws.title = "Cham cong"
ws.append(["BẢNG CHẤM CÔNG THÁNG 9"])  # dòng tiêu đề phụ trước dòng cột
ws.append(["Tên đăng nhập", "Ngày", "Giờ vào", "Giờ ra", "Ghi chú"])
ws.append(["linh.tran", dt.datetime(2026, 9, 10), dt.time(8, 0), dt.time(16, 30), ""])        # hợp lệ 8,5h
ws.append(["hung.pham", "10/09/2026", "22:00", "06:00", "Ca đêm"])                              # qua đêm 8h
ws.append(["khong.ton.tai", "10/09/2026", "08:00", "12:00", ""])                                # lỗi NV
ws.append(["linh.tran", "31/02/2026", "08:00", "12:00", ""])                                    # lỗi ngày
ws.append(["linh.tran", "10/09/2026", "09:00", "10:00", ""])                                    # chồng giờ dòng 3
ws.append(["mai.vo", "10/10/2026", "08:00", "12:00", ""])                                       # kỳ đã chốt
ws.append(["khoa.le", "11/09/2026", "08:00", None, "Quên chấm ra"])                             # thiếu giờ ra (hợp lệ)
ws.append(["khoa.le", "12/09/2026", "08:00", "01:00", ""])                                      # > 16 giờ
ws.append([None, None, None, None, None])                                                       # dòng trống
ws.append(["son.dang@royalbeef.vn", "12/09/2026", "10:00", "14:00", "Theo email"])            # hợp lệ (email)
wb.save(out + "/att-test.xlsx")

wb2 = Workbook()
wb2.active.append(["Ngày", "Ghi chú"])
wb2.save(out + "/att-bad.xlsx")

with open(out + "/att-test.csv", "w", encoding="utf-8-sig", newline="") as f:
    f.write("Tên đăng nhập;Ngày;Giờ vào;Giờ ra;Ghi chú\r\n")
    f.write("duc.huynh;15/09/2026;8h;12:00;\"Ca sáng; có dấu chấm phẩy\"\r\n")
    f.write("duc.huynh;15/09/2026;13:00;17:30;\r\n")
print("ok")
