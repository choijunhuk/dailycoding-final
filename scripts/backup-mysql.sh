#!/bin/bash
# Daily MySQL backup to local + (optional) S3.
# Crontab (recommended):  0 2 * * * /home/kw/dailycoding-final/scripts/backup-mysql.sh >> /home/kw/backup.log 2>&1
#
# Env required:
#   DB_NAME, DB_USER, DB_PASS — read from the backend .env file
# Env optional:
#   BACKUP_S3_BUCKET   — if set, uploads via `aws s3 cp` (requires AWS CLI + creds)
#   BACKUP_RETAIN_DAYS — number of daily backups to keep locally (default 7)
set -euo pipefail

REPO_DIR="${REPO_DIR:-/home/kw/dailycoding-final}"
BACKUP_DIR="${BACKUP_DIR:-/home/kw/dailycoding-backups}"
RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-7}"

# Load .env (no shell expansion of password contents)
if [ -f "$REPO_DIR/dailycoding-server/.env" ]; then
  set -a
  # shellcheck disable=SC1090
  source <(grep -E '^(DB_NAME|DB_USER|DB_PASS)=' "$REPO_DIR/dailycoding-server/.env")
  set +a
fi

: "${DB_NAME:?DB_NAME not set}"
: "${DB_USER:?DB_USER not set}"
: "${DB_PASS:?DB_PASS not set}"

TS=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"
OUT="$BACKUP_DIR/dailycoding_${TS}.sql.gz"

echo "[$(date -Iseconds)] Backing up $DB_NAME to $OUT"

# mysqldump runs inside the live MySQL container so we don't need a host client.
docker exec -i \
  -e MYSQL_PWD="$DB_PASS" \
  dailycoding-mysql \
  mysqldump --single-transaction --quick --routines --triggers \
    -u "$DB_USER" "$DB_NAME" \
  | gzip > "$OUT"

SIZE=$(du -h "$OUT" | cut -f1)
echo "[$(date -Iseconds)] OK — wrote $SIZE"

# Prune old local backups
find "$BACKUP_DIR" -maxdepth 1 -name 'dailycoding_*.sql.gz' -mtime +"$RETAIN_DAYS" -delete

# Optional S3 upload
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  if command -v aws >/dev/null 2>&1; then
    aws s3 cp "$OUT" "s3://$BACKUP_S3_BUCKET/$(basename "$OUT")" --only-show-errors
    echo "[$(date -Iseconds)] Uploaded to s3://$BACKUP_S3_BUCKET/"
  else
    echo "[$(date -Iseconds)] WARN: BACKUP_S3_BUCKET set but aws CLI not installed."
  fi
fi
