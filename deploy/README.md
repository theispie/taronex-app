# การติดตั้งขึ้นเครื่องจริง

## ภาพรวม

```
push ขึ้น main
   └─ GitHub Actions  (.github/workflows/release.yml)
        tsc · biome · migration · เทสต์หน่วย · build · เทสต์เบราว์เซอร์
        └─ ออก release "latest" พร้อม taronex.tar.gz + .sha256

บนเครื่อง:  sudo deploy/pull-release.sh
   ดาวน์โหลด → ตรวจลายนิ้วมือ → migration → สลับ symlink → เช็คสุขภาพ
   เปิดไม่ขึ้นภายใน 60 วินาที → สลับกลับให้เอง
```

## ทำไม build ที่ GitHub ไม่ build บนเครื่อง

เครื่องมี RAM 961 MB และ Postgres จองไว้ 200 MB
`next build` ต้องตั้ง `--max-old-space-size=768` แล้วถึงจะรอด และ `tsc` เริ่ม OOM เป็นครั้งคราว
BUILD-PLAN เขียนไว้เองว่าถ้าถึงจุดนี้ให้ย้ายไป GitHub Actions **อย่าไล่เพิ่มตัวเลขไปเรื่อยๆ**

`pnpm build` บนเครื่องยังใช้ได้อยู่สำหรับตอนแก้เร่งด่วน แต่ไม่ใช่ทางหลักแล้ว

## ทำไมเครื่องเป็นฝ่าย "ดึง" ไม่ใช่ให้ GitHub "ส่ง"

GitHub ไม่ต้องรู้จักเครื่องนี้ และไม่ต้องเก็บกุญแจ SSH ไว้ใน secret
ถ้าบัญชี GitHub ถูกเจาะ คนร้ายแก้โค้ดได้ แต่ยิงคำสั่งเข้าเครื่องนี้ตรงๆ ไม่ได้

**ไม่ต้องตั้ง secret เพิ่มเลยสักตัว** เพราะ repo เปิดสาธารณะ ดาวน์โหลด release ได้ด้วย curl เปล่าๆ
ถ้าวันหนึ่งเปลี่ยนเป็น repo ปิด ต้องใส่ token ให้ `curl` ที่ `deploy/pull-release.sh`

## โครงบนเครื่อง

```
/opt/taronex-releases/
  current -> 20260825-013509     ← systemd ชี้ที่ symlink นี้
  20260825-013509/               ← แต่ละเวอร์ชันอยู่โฟลเดอร์ของตัวเอง
  20260824-221130/               ← เก็บย้อนหลัง 3 ชุด
```

`systemd` unit ชี้ที่ `/opt/taronex-releases/current` ไม่ใช่โฟลเดอร์จริง
การสลับเวอร์ชันจึงเป็นการเปลี่ยน symlink ครั้งเดียว ไม่มีช่วงที่ไฟล์ปนกันสองเวอร์ชัน

## คำสั่ง

```bash
sudo deploy/pull-release.sh                 # ติดตั้งเวอร์ชันล่าสุด
sudo deploy/pull-release.sh build-abc123def # ติดตั้งเวอร์ชันเจาะจง
```

**ถอยกลับด้วยมือ** เมื่อเจอปัญหาทีหลัง (สคริปต์ถอยให้เองเฉพาะตอนเปิดไม่ขึ้น):

```bash
ls -1dt /opt/taronex-releases/2*
sudo ln -sfn /opt/taronex-releases/<เวอร์ชันเก่า> /opt/taronex-releases/current
sudo systemctl restart taronex-web
```

## ข้อควรระวังเรื่อง migration

สคริปต์รัน `drizzle-kit migrate` **ก่อน** สลับโค้ด เพราะโค้ดใหม่คาดหวังคอลัมน์ใหม่

ทุก migration ที่มีตอนนี้เป็นแบบ**เพิ่มอย่างเดียว** โค้ดเก่าจึงยังทำงานกับสคีมาใหม่ได้
ถ้าวันหนึ่งต้องลบหรือเปลี่ยนชนิดคอลัมน์ **ให้แยกเป็นสองรอบ deploy** —
รอบแรกเพิ่มของใหม่และเลิกใช้ของเก่า รอบที่สองค่อยลบ ไม่งั้นถอยกลับไม่ได้

## ค่าลับที่ต้องมีบนเครื่อง

อยู่ที่ `/etc/taronex/web.env` สิทธิ์ `600` ไม่อยู่ใน git

| ตัวแปร | จำเป็น | ผลถ้าไม่มี |
|---|---|---|
| `DATABASE_URL` | ✅ | แอปเปิดไม่ขึ้น |
| `SESSION_SECRET` | ✅ | **แอปโยนข้อผิดพลาดทันที** — ดู `src/lib/auth/secret.ts` |
| `S3_*` | ยังไม่ต่อของจริง | อัปโหลดไฟล์ใช้ไม่ได้ |
| `RESEND_API_KEY` | ยังไม่มี | อีเมลไม่ถูกส่ง ลิงก์ลง log แทน |

สร้าง `SESSION_SECRET` ด้วย `openssl rand -base64 48`
**เปลี่ยนค่านี้เมื่อไร เซสชันพอร์ทัลกับลิงก์ตั้งรหัสที่ยังไม่ใช้จะเป็นโมฆะทั้งหมด**
(เซสชันฝั่งทีมไม่กระทบ เพราะเก็บ hash ไว้ในตาราง `sessions` ไม่ได้เซ็นด้วยกุญแจนี้)

## ความปลอดภัยระดับเครื่อง

### `/app/internal` ปิดด้วยรหัสผ่าน
ตั้งที่ nginx ไม่ใช่ในแอป — แอปพังเมื่อไหร่ หน้านี้ก็ยังปิดอยู่
ไฟล์รหัส `/etc/nginx/.htpasswd-internal` (bcrypt) · เพิ่ม/เปลี่ยนผู้ใช้:

```bash
sudo htpasswd -B /etc/nginx/.htpasswd-internal <ชื่อผู้ใช้>
sudo systemctl reload nginx
```

### พอร์ต 80/443 เปิดให้เฉพาะ Cloudflare
```bash
sudo /usr/local/sbin/taronex-cf-firewall   # (สำเนาอยู่ที่ deploy/cf-firewall.sh)
```
รันซ้ำได้เสมอ · **ถ้าวันหนึ่งเว็บเข้าไม่ได้ ให้รันนี่ก่อนเป็นอย่างแรก**
เพราะช่วง IP ของ Cloudflare เปลี่ยนได้ แล้วกฎเดิมจะกันของจริงออกไปด้วย

ถ้าอยากเลิกใช้ Cloudflare ให้เปิดคืนด้วย
```bash
sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
```

### ⚠ ยังไม่ได้ทำ — เข้ารหัสช่วง Cloudflare→เครื่อง
ตอนนี้ Cloudflare ส่งต่อมาที่เครื่องด้วย HTTP ธรรมดา คุกกี้เซสชันกับรหัส basic auth
จึงวิ่งผ่านอินเทอร์เน็ตแบบไม่เข้ารหัสในช่วงนั้น

แก้โดยตั้ง Cloudflare SSL เป็น **Full (strict)** แล้วลง **Origin Certificate** ที่ nginx
(ต้องทำที่แดชบอร์ด Cloudflare)

## สำรองข้อมูล

```bash
sudo /opt/taronex-app/deploy/backup.sh      # รันเองได้ทุกเมื่อ
crontab -l                                   # ตั้งไว้แล้ว: ทุกคืนตี 3
tail -f /var/log/taronex-backup.log          # ดูผลย้อนหลัง
```

ไฟล์อยู่ที่ `/var/backups/taronex/` เก็บย้อนหลัง 14 วัน สิทธิ์ 600

### สคริปต์เดิมใช้ไม่ได้เลยสักครั้ง
ของเดิมเรียก `deploy/docker-compose.yml` ที่ไม่มีอยู่จริง · ใช้ `s3cmd` ที่ไม่ได้ลง ·
ชี้ไปที่เก็บไฟล์ที่ยังไม่มี **และไม่เคยถูกตั้งเวลาให้รัน**
เขียนใหม่ให้ทำงานได้ด้วยของที่มีบนเครื่อง — สำรองที่รันไม่ได้แย่กว่าไม่มีสำรอง
เพราะมันหลอกให้คิดว่ามีอยู่

### ตรวจไฟล์ทุกครั้งที่สำรอง
หลังเขียนเสร็จ สคริปต์ให้ `pg_restore -l` อ่านสารบัญในไฟล์
ถ้าอ่านไม่ได้จะ**ลบทิ้งแล้วออกด้วยรหัสผิดพลาด** ไม่เก็บของที่กู้ไม่ได้ไว้หลอกตัวเอง

### กู้คืน — ทดสอบจริงแล้ว 25 ส.ค. 2569
กู้ลงฐานใหม่แล้วนับแถวเทียบกับฐานจริง ตรงกันทุกตัว (ที่ทำงาน 164 · การ์ด 227 · ประวัติ 350)

```bash
F=$(ls -t /var/backups/taronex/*.dump | head -1)
docker exec -e PGPASSWORD=devonly taronex-app-db-1 psql -U postgres -c 'create database taronex_check'
docker exec -i -e PGPASSWORD=devonly taronex-app-db-1 \
  pg_restore -U postgres -d taronex_check --no-owner --no-privileges < "$F"
```

กู้ทับฐานจริงให้หยุดแอปก่อน แล้วค่อย `pg_restore --clean --if-exists -d taronex`

### ⚠ ยังไม่มีสำเนานอกเครื่อง
ไฟล์อยู่บน**ดิสก์ก้อนเดียวกับฐานข้อมูล** กันได้แค่ ลบผิด · migration พัง · ข้อมูลเสีย
**ไม่ได้กัน droplet หาย** — ต้องรอที่เก็บไฟล์ภายนอก (R2/Spaces) แล้วเพิ่มขั้นส่งขึ้นไป
