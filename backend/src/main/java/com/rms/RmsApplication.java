package com.rms;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;

// Bỏ tài khoản mặc định "user" + mật khẩu ngẫu nhiên của Spring Security: đăng nhập dùng bảng users (com.rms.auth).
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
public class RmsApplication {
    public static void main(String[] args) {
        SpringApplication.run(RmsApplication.class, args);
    }
}
