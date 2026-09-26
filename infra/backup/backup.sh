#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_ADMIN_URL:?Set DATABASE_ADMIN_URL to the backup connection}"
BACKUP_DIR="${BACKUP_DIR:-./backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive="$BACKUP_DIR/hims-$timestamp.dump"

echo "Creating PostgreSQL custom-format backup: $archive"
pg_dump "$DATABASE_ADMIN_URL" --format=custom --no-owner --no-acl --file="$archive"

sha256sum "$archive" > "$archive.sha256"
pg_restore --list "$archive" >/dev/null

find "$BACKUP_DIR" -type f -name 'hims-*.dump' -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -type f -name 'hims-*.dump.sha256' -mtime +"$RETENTION_DAYS" -delete

echo "Backup verified and retention applied."
