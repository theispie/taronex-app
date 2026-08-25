#!/usr/bin/env bash
#
# สำรองฐานข้อมูล
#
# ═══ 🔴 ทำไมต้องเขียนใหม่ทั้งไฟล์ ═══
# ของเดิมรันไม่ผ่านเลยสักครั้ง และไม่เคยถูกตั้งเวลาให้รันด้วย
#   · เรียก `deploy/docker-compose.yml` ซึ่งไม่มีอยู่จริง (ของจริงคือ docker-compose.dev.yml ที่ราก)
#   · ใช้ `s3cmd` ซึ่งไม่ได้ลงไว้บนเครื่อง
#   · ชี้ไป s3://taronex-backup ซึ่งยังไม่มีที่เก็บไฟล์ภายนอก
#
# เขียนใหม่ให้**ทำงานได้วันนี้ด้วยของที่มีอยู่บนเครื่อง** แล้วค่อยเพิ่มสำเนานอกเครื่องทีหลัง
# สำรองที่รันไม่ได้ ไม่ใช่สำรอง — และที่แย่กว่าคือมันหลอกให้คิดว่ามีสำรองอยู่
#
# ═══ ⚠ ข้อจำกัดที่ต้องรู้ ═══
# ไฟล์อยู่บน**ดิสก์ก้อนเดียวกับฐานข้อมูล** เครื่องหายก็หายทั้งคู่
# กันได้แค่ "ลบผิด · migration พัง · ข้อมูลเสีย" ไม่ได้กัน "droplet ระเบิด"
# สำเนานอกเครื่องต้องรอที่เก็บไฟล์ (R2/Spaces) — ดู `deploy/README.md`
#
# ใช้:  sudo /opt/taronex-app/deploy/backup.sh
# cron: 0 3 * * * /opt/taronex-app/deploy/backup.sh >> /var/log/taronex-backup.log 2>&1

set -euo pipefail

DB_CONTAINER="${DB_CONTAINER:-taronex-app-db-1}"
DB_NAME="${DB_NAME:-taronex}"
DEST="${BACKUP_DIR:-/var/backups/taronex}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"

log() { printf '%s · %s\n' "$(date '+%F %T')" "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "ต้องรันด้วย sudo" >&2; exit 1; }

docker inspect "$DB_CONTAINER" >/dev/null 2>&1 || {
  log "✕ ไม่พบคอนเทนเนอร์ $DB_CONTAINER"
  exit 1
}

mkdir -p "$DEST"
chmod 700 "$DEST"

STAMP=$(date +%Y%m%d-%H%M%S)
FILE="$DEST/$DB_NAME-$STAMP.dump"

log "เริ่มสำรอง $DB_NAME"
# -Fc = รูปแบบบีบอัดของ Postgres · กู้ด้วย pg_restore ได้ทีละตาราง ไม่ต้องกู้ทั้งก้อน
docker exec -e PGPASSWORD="${PGPASSWORD:-devonly}" "$DB_CONTAINER" \
  pg_dump -Fc -U postgres "$DB_NAME" > "$FILE.part"

# เปลี่ยนชื่อหลังเขียนเสร็จเท่านั้น — ไฟล์ที่ยังเขียนไม่จบจะได้ไม่ถูกนับเป็นสำรองที่ใช้ได้
mv "$FILE.part" "$FILE"
chmod 600 "$FILE"

SIZE=$(du -h "$FILE" | cut -f1)
log "เขียนแล้ว $FILE ($SIZE)"

# ═══ ตรวจว่าไฟล์อ่านได้จริง ═══
# ไม่ได้กู้จริง แต่ให้ pg_restore อ่านสารบัญในไฟล์ — จับไฟล์เสียหรือเขียนไม่ครบได้
# `pg_restore -l` ที่ไม่ใส่ชื่อไฟล์จะอ่านจาก stdin — ระบุ /dev/stdin แล้วไม่ทำงานในคอนเทนเนอร์
if docker exec -i "$DB_CONTAINER" pg_restore -l < "$FILE" > /dev/null 2>&1; then
  log "ตรวจไฟล์ผ่าน · อ่านสารบัญได้"
else
  log "✕ ไฟล์สำรองอ่านไม่ได้ — ลบทิ้งแล้ว ไม่เก็บของที่กู้ไม่ได้ไว้หลอกตัวเอง"
  rm -f "$FILE"
  exit 1
fi

log "ลบของเก่าที่เกิน $KEEP_DAYS วัน"
find "$DEST" -name "$DB_NAME-*.dump" -mtime "+$KEEP_DAYS" -print -delete | sed 's/^/  ลบ /'

COUNT=$(find "$DEST" -name "$DB_NAME-*.dump" | wc -l)
log "เสร็จ · มีสำเนาทั้งหมด $COUNT ชุด ใน $DEST"
log "⚠ สำเนาอยู่บนดิสก์ก้อนเดียวกับฐาน — เครื่องหายก็หายด้วย ต้องมีสำเนานอกเครื่องเพิ่ม"
