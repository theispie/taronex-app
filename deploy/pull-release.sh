#!/usr/bin/env bash
#
# ติดตั้งเวอร์ชันล่าสุดที่ GitHub Actions สร้างไว้
#
# ═══ ทำไมเครื่องเป็นฝ่ายดึง ═══
# GitHub ไม่ต้องรู้จักเครื่องนี้ ไม่ต้องเก็บกุญแจ SSH ไว้ใน secret
# ถ้าบัญชี GitHub ถูกเจาะ คนร้ายแก้โค้ดได้ แต่ยิงคำสั่งเข้าเครื่องนี้ตรงๆ ไม่ได้
#
# ═══ สลับแบบอะตอมมิก และถอยกลับได้ ═══
# แต่ละเวอร์ชันแตกลงโฟลเดอร์ของตัวเอง แล้วสลับ symlink `current` ทีเดียว
# ถ้าเปิดไม่ขึ้นภายในเวลาที่กำหนด สคริปต์จะสลับกลับให้เองแล้วออกด้วยรหัสผิดพลาด
# เวอร์ชันเก่าถูกเก็บไว้ 3 ชุด — ถอยด้วยมือได้ตลอดถ้าเจอปัญหาทีหลัง
#
# ใช้: sudo deploy/pull-release.sh [tag]     ไม่ระบุ tag = latest

set -euo pipefail

REPO="${TARONEX_REPO:-theispie/taronex-app}"
TAG="${1:-latest}"
ROOT="/opt/taronex-releases"
SERVICE="taronex-web"
HEALTH="http://127.0.0.1:3000/app/api/v1/meta/health"
KEEP=3

log() { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
die() { printf '\033[31m✕ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "ต้องรันด้วย sudo"

command -v curl    >/dev/null || die "ไม่มี curl"
command -v tar     >/dev/null || die "ไม่มี tar"
command -v python3 >/dev/null || die "ไม่มี python3 (ใช้อ่านคำตอบ JSON จาก GitHub)"

# ═══ "ล่าสุด" คืออันไหน — ถาม GitHub เอา ไม่ใช้ป้ายที่ขยับได้ ═══
#
# เดิม workflow ออกป้าย `latest` ให้ด้วยการลบของเก่าแล้วสร้างใหม่ทุกรอบ
# ซึ่งแข่งกับงานลบแท็กที่ GitHub ทำค้างไว้เบื้องหลัง บางรอบ release ที่เพิ่งสร้าง
# ก็หายไปเอง แล้วสคริปต์นี้ได้ 404 ทั้งที่ CI เขียว
#
# ไล่หาเองจากรายการ release แล้วเลือกอันที่ published_at ใหม่สุด
# ไม่ใช้ /releases/latest เพราะ GitHub เรียงจากเวลาสร้าง **แท็ก** ไม่ใช่เวลาออก release
# ซึ่งไม่ตรงกันเสมอไป
if [ "$TAG" = "latest" ]; then
  log "หาเวอร์ชันล่าสุดจาก $REPO"
  TAG="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases?per_page=50" \
    | python3 -c 'import sys,json
rs=[r for r in json.load(sys.stdin) if not r["draft"] and not r["prerelease"] and r.get("published_at")]
print(max(rs, key=lambda r: r["published_at"])["tag_name"] if rs else "")')" \
    || die "ถาม GitHub ไม่สำเร็จ"
  [ -n "$TAG" ] || die "ยังไม่มี release ที่ติดตั้งได้ — รอ workflow สร้างแพ็กเกจให้เสร็จก่อน"
  log "ได้ $TAG"
fi

log "ดาวน์โหลด $TAG จาก $REPO"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# TARONEX_BASE_URL ใช้ตอนทดสอบสคริปต์นี้ หรือตอนมีมิเรอร์ภายใน
BASE="${TARONEX_BASE_URL:-https://github.com/${REPO}/releases/download/${TAG}}"
curl -fsSL "${BASE}/taronex.tar.gz"        -o "$TMP/taronex.tar.gz"        || die "ดาวน์โหลดแพ็กเกจไม่สำเร็จ"
curl -fsSL "${BASE}/taronex.tar.gz.sha256" -o "$TMP/taronex.tar.gz.sha256" || die "ดาวน์โหลดลายนิ้วมือไม่สำเร็จ"

log "ตรวจลายนิ้วมือ"
# ไฟล์ sha256 อ้างชื่อไฟล์ล้วน จึงต้องตรวจในโฟลเดอร์เดียวกัน
( cd "$TMP" && sha256sum -c taronex.tar.gz.sha256 ) || die "ลายนิ้วมือไม่ตรง — ไม่ติดตั้ง"

STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$ROOT/$STAMP"
mkdir -p "$DEST"
tar -xzf "$TMP/taronex.tar.gz" -C "$DEST"
chown -R taronex:taronex "$DEST"

# ── ฐานข้อมูล ──
# migration ต้องขึ้นก่อนสลับโค้ด เพราะโค้ดใหม่คาดหวังคอลัมน์ใหม่
# ทุก migration ในโปรเจกต์นี้เป็นแบบเพิ่มอย่างเดียว โค้ดเก่าจึงยังทำงานกับสคีมาใหม่ได้
# ถ้าวันหนึ่งต้องลบคอลัมน์ ให้แยกเป็นสองรอบ deploy อย่าทำในรอบเดียว
if [ -d "$DEST/drizzle" ] && [ -f /etc/taronex/web.env ]; then
  log "อัปเดตสคีมาฐานข้อมูล"
  # ⚠ ค่าที่มีช่องว่างหรืออักขระพิเศษต้องใส่เครื่องหมายคำพูดในไฟล์ env
  #   เพราะบรรทัดนี้ให้ shell อ่านไฟล์ตรงๆ · เคยพลาดมาแล้วกับ
  #   `EMAIL_FROM=TaroNex <onboarding@resend.dev>` ที่ shell ตีความ < > เป็นการเปลี่ยนทิศทาง
  #   แล้ว deploy ล้มทั้งรอบ · systemd ก็อ่านไฟล์เดียวกันและถอดเครื่องหมายคำพูดให้เอง
  ( cd /opt/taronex-app && set -a && . /etc/taronex/web.env && set +a \
    && pnpm exec drizzle-kit migrate && pnpm db:rls ) || die "migration ไม่ผ่าน — ยังไม่สลับเวอร์ชัน"
fi

PREV=""
[ -L "$ROOT/current" ] && PREV="$(readlink -f "$ROOT/current")"

log "สลับไปเวอร์ชัน $STAMP"
ln -sfn "$DEST" "$ROOT/current"
systemctl restart "$SERVICE"

log "รอให้แอปตอบ"
ok=0
for _ in $(seq 1 30); do
  # ไม่ใส่ -S ระหว่างรอ ไม่งั้นจะพ่น "connection refused" ทุกรอบตอนแอปยังไม่ขึ้น
  if curl -fs -o /dev/null "$HEALTH"; then ok=1; break; fi
  sleep 2
done

if [ "$ok" -ne 1 ]; then
  printf '\033[31m✕ เปิดไม่ขึ้น — สลับกลับ\033[0m\n' >&2
  if [ -n "$PREV" ]; then
    ln -sfn "$PREV" "$ROOT/current"
    systemctl restart "$SERVICE"
    printf 'กลับไปที่ %s แล้ว\n' "$PREV" >&2
  fi
  journalctl -u "$SERVICE" -n 40 --no-pager >&2
  exit 1
fi

log "เก็บกวาดเวอร์ชันเก่า (เก็บไว้ $KEEP ชุด)"
# shellcheck disable=SC2012
ls -1dt "$ROOT"/2* 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
  [ "$old" = "$(readlink -f "$ROOT/current")" ] && continue
  rm -rf "$old"
  echo "  ลบ $old"
done

printf '\n\033[32m✓ ติดตั้ง %s เรียบร้อย\033[0m\n' "$STAMP"
curl -fsS "$HEALTH"
echo
