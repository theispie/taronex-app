#!/usr/bin/env bash
#
# เปิดพอร์ต 80/443 ให้เฉพาะ Cloudflare
#
# ทำไม: DNS ของ taronex.theerawut.com วิ่งผ่าน Cloudflare อยู่แล้ว
# แต่พอร์ต 80 เดิมเปิดให้ทั้งอินเทอร์เน็ต ใครรู้ IP เครื่องก็ยิงตรงเข้ามาได้
# ข้าม WAF · ข้าม rate limit · และเห็นเว็บเป็น HTTP ธรรมดา (ไม่มี TLS)
# ใน log เจอสแกนเนอร์ยิงตรงมาแล้วจริง
#
# ⚠ ช่วง IP ของ Cloudflare เปลี่ยนได้ · รันสคริปต์นี้ซ้ำเพื่ออัปเดต
#    ถ้าวันหนึ่งเว็บเข้าไม่ได้หลัง Cloudflare เปลี่ยนช่วง IP ให้รันนี่ก่อนเป็นอย่างแรก
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "ต้องรันด้วย sudo" >&2; exit 1; }

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
curl -fsS --max-time 20 https://www.cloudflare.com/ips-v4 -o "$TMP/v4"
curl -fsS --max-time 20 https://www.cloudflare.com/ips-v6 -o "$TMP/v6"
[ -s "$TMP/v4" ] || { echo "ดึงช่วง IP ไม่ได้ — ไม่แตะกฎเดิม" >&2; exit 1; }

# ไฟล์ของ Cloudflare ไม่มีบรรทัดใหม่ปิดท้าย · cat ตรงๆ แล้วบรรทัดสุดท้ายของ v4
# จะติดกับบรรทัดแรกของ v6 กลายเป็น "131.0.72.0/222400:cb00::/32" แล้ว ufw ปฏิเสธ
# `awk 1` เติมบรรทัดใหม่ให้ทุกไฟล์ก่อนต่อกัน
awk 1 "$TMP/v4" "$TMP/v6" > "$TMP/all"

echo "▸ เพิ่มกฎของ Cloudflare ก่อน (ยังไม่ปิดของเดิม จะได้ไม่มีช่วงที่เว็บล่ม)"
while read -r net; do
  [ -n "$net" ] || continue
  ufw allow proto tcp from "$net" to any port 80,443 comment 'cloudflare' >/dev/null
done < "$TMP/all"

echo "▸ ปิดกฎเดิมที่เปิดให้ทั้งอินเทอร์เน็ต"
# ลบทีละข้อแล้วอ่านเลขใหม่ทุกครั้ง — เลขกฎเลื่อนหลังลบ การเก็บเลขไว้ล่วงหน้าแล้วไล่ลบ
# เคยพลาดมาแล้ว (เหลือกฎที่ควรถูกลบค้างอยู่) · ช้ากว่านิดเดียวแต่ถูกเสมอ
# รูปแบบต้องรับ "80/tcp (v6)" ด้วย ไม่ใช่แค่ "80/tcp"
while :; do
  # ต้องมี `|| true` — grep ที่ไม่เจออะไรคืนสถานะ 1
  # แล้ว `set -e` จะฆ่าสคริปต์ทิ้งกลางคัน ทำให้กฎ v6 ค้างอยู่โดยไม่มีอะไรฟ้อง
  # (เจอมาแล้วตอนรันจริง — สคริปต์ "ผ่าน" แต่ทำงานไม่จบ)
  n=$(ufw status numbered \
      | grep -E '^\[[ 0-9]+\] (80|443)/tcp( \(v6\))? +ALLOW IN +Anywhere' \
      | head -1 | grep -oE '^\[[ 0-9]+\]' | tr -d '[] ' || true)
  [ -n "$n" ] || break
  yes | ufw delete "$n" >/dev/null
done

cp "$TMP/all" /etc/taronex/cloudflare-ips.txt
echo "▸ เรียบร้อย · SSH (22) ยังเปิดตามเดิม"
ufw status | head -30
