# Backup and disaster-recovery baseline

Phase 0 establishes an executable backup and restore-drill path.

Create a backup:

    DATABASE_ADMIN_URL=... BACKUP_DIR=/secure/off-host/path bash infra/backup/backup.sh

Verify an archive:

    BACKUP_FILE=/secure/path/hims-....dump CHECKSUM_FILE=/secure/path/hims-....dump.sha256 bash infra/backup/verify.sh

Run a restore drill into an isolated database:

    ALLOW_DESTRUCTIVE_RESTORE=YES     DATABASE_ADMIN_URL=...     BACKUP_FILE=...     TARGET_DATABASE_URL=...     bash infra/backup/restore-drill.sh

The production target is encrypted off-host storage with a defined RPO/RTO and, where the deployment tier requires it, continuous WAL archiving/pgBackRest. Docker volumes are not backups.

The custom PostgreSQL archive format is intentional: it can be inspected with pg_restore and restored selectively. Backup files contain sensitive hospital data and must be encrypted at rest and access-controlled.
