package com.rms.backup;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Bật @Scheduled cho tự động sao lưu theo lịch (BackupService.autoBackupTick). */
@Configuration
@EnableScheduling
class BackupConfig {}
