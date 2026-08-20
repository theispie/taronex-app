#!/bin/bash
# สำรองฐานข้อมูลขึ้น Spaces ทุกคืน · ตั้งใน cron: 0 3 * * * /opt/taronex-app/deploy/backup.sh
#
# สำคัญ — ต้องทดสอบกู้คืนจริงหนึ่งครั้งภายในสัปดาห์แรก
# สำรองที่กู้ไม่ได้ ไม่ใช่สำรอง
set -euo pipefail

STAMP=$(date +%F)
BUCKET="s3://taronex-backup"

docker compose -f /opt/taronex-app/deploy/docker-compose.yml exec -T db \
  pg_dump -Fc -U postgres taronex | s3cmd put - "$BUCKET/db-$STAMP.dump"

# เก็บย้อนหลัง 30 วัน
s3cmd ls "$BUCKET/" \
  | awk -v cutoff="$(date -d '30 days ago' +%F)" '$1 < cutoff {print $4}' \
  | xargs -r -n1 s3cmd del
