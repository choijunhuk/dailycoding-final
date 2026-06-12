# Operations Runbook

## 1. Health Check

Public endpoint:

```
GET https://dailycoding-final.com/api/health
```

Returns 200 with `{ status: "ok", services: { database, redis, judge, billing }, version }`.
Use this as the probe URL for any external uptime monitor.

## 2. Uptime Monitoring (recommended: Better Uptime / UptimeRobot)

Free options that work well:

### Better Uptime (https://betteruptime.com)

1. Sign up (free for 10 monitors)
2. Create monitor:
   - **URL**: `https://dailycoding-final.com/api/health`
   - **Check frequency**: 3 minutes
   - **Expected response code**: 200
   - **Expected response body contains**: `"status":"ok"`
3. Alert channels:
   - Email — default
   - Discord webhook — paste the bot webhook URL into the Discord OAuth app's webhook page
   - Slack/Telegram — also supported

### UptimeRobot (https://uptimerobot.com)

1. Sign up (free for 50 monitors, 5-minute interval)
2. **+ Add New Monitor** → **HTTP(s)**
3. URL: `https://dailycoding-final.com/api/health`
4. Set alert contacts (email / Telegram bot / Discord webhook)

Either service will email/notify within minutes when the site is down.

## 3. Automated MySQL Backup

Script: `scripts/backup-mysql.sh`

Install as a daily cron on the VPS:

```bash
# Edit kw user's crontab
crontab -e
```

Add:

```cron
# Daily MySQL backup at 02:00 KST
0 2 * * * /home/kw/dailycoding-final/scripts/backup-mysql.sh >> /home/kw/backup.log 2>&1
```

Backups land in `/home/kw/dailycoding-backups/` and the script keeps the last
7 (override with `BACKUP_RETAIN_DAYS`). To enable off-site S3 backup:

```bash
export BACKUP_S3_BUCKET=dailycoding-backups
aws configure  # provide IAM key with s3:PutObject on the bucket
```

Restore example (replace TIMESTAMP):

```bash
gunzip -c /home/kw/dailycoding-backups/dailycoding_TIMESTAMP.sql.gz \
  | docker exec -i dailycoding-mysql mysql -u dcuser -p"$DB_PASS" dailycoding
```

## 4. MySQL slow-query log

Enable on-demand (no restart needed):

```bash
docker exec -it dailycoding-mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "
  SET GLOBAL slow_query_log = 'ON';
  SET GLOBAL long_query_time = 0.3;
  SET GLOBAL slow_query_log_file = '/var/lib/mysql/slow.log';
"
```

Read after a few hours:

```bash
docker exec -it dailycoding-mysql tail -n 200 /var/lib/mysql/slow.log
```

Disable after triage:

```bash
docker exec -it dailycoding-mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SET GLOBAL slow_query_log = 'OFF';"
```

## 5. Sentry

- DSN configured via `SENTRY_DSN` in `dailycoding-server/.env`
- Release auto-tags as `dailycoding-server@<short-sha>` when run from a git checkout
- Dashboard: https://sentry.io → Projects → dailycoding-server

## 6. Common operations

```bash
# Backend logs (tail)
docker logs -f dailycoding-backend

# Restart backend only (keep DB/Redis running)
docker compose restart backend

# Rebuild + restart after a code change
cd ~/dailycoding-final && docker compose up -d --build backend

# Drop into MySQL shell
docker exec -it dailycoding-mysql mysql -u dcuser -p"$DB_PASS" dailycoding
```
