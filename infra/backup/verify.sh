#!/usr/bin/env bash
set -euo pipefail

: "${BACKUP_FILE:?Set BACKUP_FILE to a .dump archive}"
: "${CHECKSUM_FILE:?Set CHECKSUM_FILE to the matching .sha256 file}"

sha256sum --check "$CHECKSUM_FILE"
pg_restore --list "$BACKUP_FILE" >/dev/null

echo "Backup checksum and archive catalog verified."
