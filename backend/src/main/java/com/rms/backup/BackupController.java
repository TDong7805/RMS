package com.rms.backup;

import com.rms.backup.BackupService.BackupFile;
import com.rms.backup.BackupService.RestoreResult;
import java.nio.file.Path;
import java.util.List;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * GET    /api/backups                  danh sách bản sao lưu (mới nhất trước)
 * POST   /api/backups                  sao lưu ngay (bản "manual")
 * GET    /api/backups/{id}/download    tải file .zip về máy
 * POST   /api/backups/{id}/restore     phục hồi (tự tạo bản an toàn trước; lỗi thì dữ liệu giữ nguyên)
 * DELETE /api/backups/{id}
 * Lịch tự động: GET/PUT /api/settings/backup-schedule (SettingsController); BackupService chạy theo lịch mỗi phút.
 */
@RestController
@RequestMapping("/api/backups")
public class BackupController {
    private final BackupService service;

    public BackupController(BackupService service) {
        this.service = service;
    }

    @GetMapping
    public List<BackupFile> list() {
        return service.list();
    }

    @PostMapping
    public BackupFile create() {
        return service.createManual();
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<Resource> download(@PathVariable String id) {
        Path file = service.file(id);
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType("application/zip"))
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(file.getFileName().toString()).build().toString())
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            .body(new FileSystemResource(file));
    }

    @PostMapping("/{id}/restore")
    public RestoreResult restore(@PathVariable String id) {
        return service.restore(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
