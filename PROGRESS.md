# ความคืบหน้า TaroNex

> สรุปท้ายทุกหมุดหมาย เพื่อให้ session ถัดไปเริ่มได้เร็ว
> อัปเดตล่าสุด 20 ส.ค. 2569

---

## สถานะรวม

**ยังไม่เริ่ม M0** ตามแผนเดิม — แต่มี **ต้นแบบหน้าจอทั้ง 52 หน้าที่รันได้จริง**
สร้างไว้ก่อนเพื่อตรวจ UX ก่อนลงทุนทำฐานข้อมูล

| | |
|---|---|
| ใช้งานได้ที่ | https://taronex.theerawut.com/app |
| โค้ด | https://github.com/theispie/taronex-app (branch `main`) |
| บนเครื่อง | `/opt/taronex-app` · deploy key อยู่ที่ `/root/.ssh/taronex_deploy` |

---

## ทำเสร็จแล้ว

### หน้าจอครบ 52 หน้า (47 route) — frontend อย่างเดียว
Next.js 15 App Router · TypeScript strict · Tailwind · basePath `/app`
**ยังไม่มีฐานข้อมูล ไม่มี API** ข้อมูลทั้งหมดอยู่ใน `src/mock/data.ts`
รูปทรงข้อมูลตรงกับพจนานุกรมข้อมูล ตอนต่อ backend เปลี่ยนแค่ที่มาของข้อมูล

ดีไซน์ยกมาจาก `docs/screens/_shared.css` ของต้นแบบทั้งชุด ไม่มีสีที่คิดขึ้นเอง
ถ้อยคำไทยยกจากบล็อก “ถ้อยคำ (ห้ามแปลใหม่)” ของแต่ละ `NN.md`

### เครื่องและการ deploy
- Droplet 512 MB + **swap 2 GB** (จำเป็น — ไม่มี swap แล้ว `pnpm install` และ `next build` ตายเพราะ OOM)
- `next build` บนเครื่องนี้ใช้เวลา ~20 วิ ผ่านได้ **ถ้ามี swap** (แก้สมมติฐานเดิมใน BUILD-PLAN ที่ว่าต้อง build ที่ GitHub Actions เท่านั้น)
- systemd: `taronex-web` (Next.js :3000) · `taronex-uploader` (หน้าอัปโหลดเอกสาร :8000)
- nginx: `/` หน้ารอ · `/app` ระบบ · `/prototype` ต้นแบบ 52 หน้า · `/readme` หน้าอัปโหลด
- HTTPS มาจาก Cloudflare (origin เสิร์ฟ HTTP:80)

---

## การตัดสินใจที่เปลี่ยนจากสเปคเดิม — อ่านก่อนทำต่อ

### 1. แยก tenant ด้วย path ไม่ใช่ subdomain
`/app/<รหัสสุ่ม 12 ตัว>/…` แทน `{slug}.taronex.co`
รหัสอยู่ใน `src/lib/tenant-code.ts` พร้อมรายการคำสงวน เตรียมไว้สำหรับวันที่ให้ตั้งชื่อเอง

**ผลด้านความปลอดภัยที่ต้องจัดการตอนทำ backend:**
- รหัสใน URL **ไม่ใช่สิทธิ์** ต้องตรวจ membership ฝั่งเซิร์ฟเวอร์ทุก request
- พอร์ทัลลูกค้าอยู่ origin เดียวกับฝั่งทีมแล้ว → ขัดกฎข้อ 6 โดยตรง
  ต้องแยกด้วยโค้ด: คุกกี้คนละชื่อ คนละ secret · API พอร์ทัลต้องปฏิเสธ session ของทีม
  **ก่อนรับลูกค้าจริงควรกลับไปใช้คนละโดเมนตามสเปคเดิม**
- CSRF สำคัญขึ้นเพราะ origin เดียว → SameSite=Lax + ตรวจ Origin ทุก mutation
- ตั้ง `Referrer-Policy: same-origin` แล้ว (กันรหัสรั่วผ่าน Referer)
- `/readme` อยู่ origin เดียวกับระบบจริง มี upload + รหัสผ่านเดียว **ต้องย้ายออกหรือปิดก่อนขึ้นจริง**

### 2. ไม่มี `task_status` แล้ว — เหลือแต่คอลัมน์
กฎข้อ 8 ใน `CLAUDE.md` ถูกเขียนใหม่ทั้งข้อ อ่านหัวข้อ “โมเดลของบอร์ด” ก่อนแตะอะไรที่เกี่ยวกับการ์ด

เก็บจริงแค่ 2 ฟิลด์: `projects.board` (ชื่อ+ลำดับ) กับ `tasks.column_key`
กติกาคำนวณสดจากตำแหน่งและทิศทางการลาก

**ที่ต้องระวังตอนทำ `task_events`** คอลัมน์ลบได้แต่ประวัติลบไม่ได้ →
ต้องบันทึกชื่อคอลัมน์และตำแหน่ง ณ ตอนนั้นลงในเหตุการณ์ด้วย

### 3. เอกสารที่แก้ตามแล้ว / ที่ยังไม่ได้แก้
- ✅ `CLAUDE.md` (ทั้งใน repo และใน `readme/` สองสำเนา)
- ✅ `BUILD-PLAN.md` — กฎข้อ 8 · `guard_task_column` · เทส M5 เปลี่ยนเป็นเทสตามทิศทาง
- ❌ **`taronex-architecture.html` ยังนิยาม `task_status` เป็น enum อยู่** — ต้องแก้ตอนทำ M1

---

## ข้อขัดแย้งในสเปคที่พบตอนอ่าน (ยังไม่ได้แก้เอกสาร)

| เรื่อง | ขัดกันยังไง | ควรยึด |
|---|---|---|
| โดเมนพอร์ทัล | CLAUDE.md/BUILD-PLAN = `taronex-support.com` · SCREENS.md/06/30/32 = `support.digitalx.taronex.co` | `-support.com` (เหตุผลเรื่องคุกกี้) |
| บทบาท | 05.md/08.md = มีแค่ owner/member · ที่อื่น = 4 ค่า | 4 ค่า |
| `job_title` | 08.md = `users.job_title` · M1 + 43.md = `memberships` | `memberships` |
| Timeline export | 19.md = ฝั่ง server แปลง PNG/PDF · M7 = ยังไม่ทำ ใช้ `@media print` | M7 |
| กฎมีกี่ข้อ | architecture.html = 7 ข้อ · CLAUDE.md = 12 ข้อ | 12 ข้อ |
| ที่เก็บไฟล์ | enum `storage_provider = r2` · tech stack = DigitalOcean Spaces | Spaces |
| URL หน้าสมัคร | 01.md = `app.taronex.co/signup` · ที่อื่น = `taronex.co` | ไม่มี `app.` |
| รายการ stack | CLAUDE.md ไม่มี Sentry กับ react-email แต่ BUILD-PLAN มี | เติมเข้า CLAUDE.md |

---

## ทำต่อได้เลย — เลือกทางใดทางหนึ่ง

**ทาง A · ทำ UX ให้กดได้จริงก่อน (ไม่ต้องรอ backend)**
กล่องเลือก/สลับมุมมองที่ยังกดไม่ได้ ~45 ปุ่ม · ลากวางบอร์ดด้วย dnd-kit
ได้ประโยชน์คือรู้ว่า UX ใช้ได้ไหมก่อนลงทุนทำฐานข้อมูล

**ทาง B · เริ่ม M0 ตามแผนเดิม**
Docker + Postgres 17 + MinIO + Mailpit · GitHub Actions build
(หมายเหตุ: swap ทำไว้แล้ว · ufw ยังไม่ได้เปิด · docker ยังไม่ได้ลง)

**ทาง C · เริ่ม M1 สคีมาและ RLS**
ต้องแก้ `taronex-architecture.html` ให้ตรงกับโมเดลคอลัมน์แบบใหม่ก่อน

---

## เดิม

## M0 · ตั้งฐานและเครื่อง
- [ ] ยังไม่เริ่ม (swap 2 GB ทำแล้ว · ufw และ docker ยังไม่ได้ทำ)
