/* =====================================================================
   V2 — Bảng lưu phiên đăng nhập (Spring Session JDBC)

   Phiên lưu trong CSDL thay vì bộ nhớ của backend:
     - khởi động lại / cập nhật backend không đẩy mọi người ra khỏi hệ thống;
     - chạy nhiều máy chủ backend sau một bộ cân bằng tải vẫn dùng chung phiên.
   Cấu trúc lấy nguyên từ org/springframework/session/jdbc/schema-mysql.sql (spring-session-jdbc 3.5).
   Tên bảng viết HOA theo đúng câu SQL của Spring Session (MySQL trên Linux phân biệt hoa thường).
   Phiên hết hạn được Spring Session tự xóa định kỳ (mỗi phút).
   ===================================================================== */

CREATE TABLE SPRING_SESSION (
  PRIMARY_ID            CHAR(36)     NOT NULL,
  SESSION_ID            CHAR(36)     NOT NULL,
  CREATION_TIME         BIGINT       NOT NULL,
  LAST_ACCESS_TIME      BIGINT       NOT NULL,
  MAX_INACTIVE_INTERVAL INT          NOT NULL,
  EXPIRY_TIME           BIGINT       NOT NULL,
  PRINCIPAL_NAME        VARCHAR(100) NULL,      -- tên đăng nhập (AuthUser.getName)
  CONSTRAINT SPRING_SESSION_PK PRIMARY KEY (PRIMARY_ID)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC;

CREATE UNIQUE INDEX SPRING_SESSION_IX1 ON SPRING_SESSION (SESSION_ID);
CREATE INDEX SPRING_SESSION_IX2 ON SPRING_SESSION (EXPIRY_TIME);
CREATE INDEX SPRING_SESSION_IX3 ON SPRING_SESSION (PRINCIPAL_NAME);

CREATE TABLE SPRING_SESSION_ATTRIBUTES (
  SESSION_PRIMARY_ID CHAR(36)     NOT NULL,
  ATTRIBUTE_NAME     VARCHAR(200) NOT NULL,
  ATTRIBUTE_BYTES    BLOB         NOT NULL,
  CONSTRAINT SPRING_SESSION_ATTRIBUTES_PK PRIMARY KEY (SESSION_PRIMARY_ID, ATTRIBUTE_NAME),
  CONSTRAINT SPRING_SESSION_ATTRIBUTES_FK FOREIGN KEY (SESSION_PRIMARY_ID)
    REFERENCES SPRING_SESSION (PRIMARY_ID) ON DELETE CASCADE
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC;
