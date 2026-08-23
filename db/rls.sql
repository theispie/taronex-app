-- ════════════════════════════════════════════════════════════════════
-- RLS · role `app` · trigger ที่บังคับกฎ
--
-- อยู่นอก drizzle/ โดยตั้งใจ — drizzle-kit จัดเลขไฟล์ของตัวเองและไม่รู้จักไฟล์นี้
-- ถ้าวางปนกันจะมีสองไฟล์ที่ขึ้นต้นด้วยเลขเดียวกัน แล้วสับสนว่าอันไหนรันไปแล้ว
-- ไฟล์นี้รันซ้ำได้เสมอ (idempotent) จึงรันหลัง migrate ทุกครั้ง
--
-- ไฟล์นี้เขียนมือ Drizzle สร้างให้ไม่ได้
-- ทุกอย่างในนี้คือกฎที่ "ผิดแล้วเงียบ" — ไม่มีอะไรพังตอนทดสอบ
-- แต่ข้อมูลลูกค้าจะรั่วข้ามบริษัท
-- ════════════════════════════════════════════════════════════════════

-- ── 1) role ของแอป ────────────────────────────────────────────────
-- กฎข้อ 1 · ต้อง NOBYPASSRLS และต้องไม่ใช่เจ้าของตาราง
-- บน Postgres ที่ติดตั้งเอง จะเผลอใช้ postgres superuser ง่ายมาก
-- ซึ่งข้าม RLS ได้ทุกกรณีแม้ใส่ FORCE
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app') THEN
    CREATE ROLE app LOGIN PASSWORD 'devonly' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app;

-- กฎข้อ 5 · task_events เขียนอย่างเดียว
REVOKE UPDATE, DELETE ON task_events FROM app;

-- ── 2) ตัวอ่านค่า tenant ปัจจุบัน ─────────────────────────────────
-- อ่านจากตัวแปรที่ตั้งด้วย set_config('app.tenant_id', …, true)
-- ตัวที่สาม = true คือ LOCAL ผูกกับธุรกรรม ไม่ติดค้างกับ connection (กฎข้อ 3)
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

-- ── 3) เปิด RLS ทุกตารางที่มี tenant_id ───────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'memberships','invitations','clients','client_contacts','portal_tokens',
    'projects','project_phases','features','project_members',
    'tasks','task_events','comments','attachments','time_entries',
    'warranty_contracts','sla_policies','sla_policy_levels',
    'sla_clocks','sla_clock_events','notifications'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    -- FORCE สำคัญ ไม่งั้นเจ้าของตารางข้าม policy ได้เงียบๆ
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($p$
      CREATE POLICY tenant_isolation ON %I
        USING (tenant_id = current_tenant_id())
        WITH CHECK (tenant_id = current_tenant_id())
    $p$, t);
  END LOOP;
END $$;

-- project_templates ต่างจากตารางอื่น — tenant_id NULL แปลว่าแม่แบบกลางที่ทุกที่ทำงานใช้ได้
ALTER TABLE project_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_templates FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON project_templates;
CREATE POLICY tenant_isolation ON project_templates
  USING (tenant_id IS NULL OR tenant_id = current_tenant_id())
  -- เขียนได้เฉพาะของที่ทำงานตัวเอง · ห้ามสร้างหรือแก้แม่แบบกลางผ่านแอป
  WITH CHECK (tenant_id = current_tenant_id());

-- ── 4) กฎข้อ 4 · คอลัมน์ขยับได้ทางเดียว ───────────────────────────
-- transition ตั้ง app.allow_column_move ก่อนเขียน แล้วค่าหายไปเองเมื่อจบธุรกรรม
-- ทางอื่นที่พยายามแก้ column_key ตรงๆ จะถูกปฏิเสธที่ชั้นฐานข้อมูล
-- ไม่ใช่แค่ชั้นแอป เพราะชั้นแอปมีวันลืม
CREATE OR REPLACE FUNCTION guard_task_column() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.column_key IS DISTINCT FROM OLD.column_key
     AND COALESCE(current_setting('app.allow_column_move', true), '') <> 'on' THEN
    RAISE EXCEPTION 'column_key เปลี่ยนได้ทาง POST /tasks/:id/transition เท่านั้น (กฎข้อ 4)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_task_column ON tasks;
CREATE TRIGGER guard_task_column
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION guard_task_column();

-- สถานะที่ลูกค้าเห็นก็มีประตูเดียวเหมือนกัน ด้วยเหตุผลเดียวกัน
CREATE OR REPLACE FUNCTION guard_portal_stage() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.portal_stage IS DISTINCT FROM OLD.portal_stage
     AND COALESCE(current_setting('app.allow_portal_stage', true), '') <> 'on' THEN
    RAISE EXCEPTION 'portal_stage เปลี่ยนได้ทาง POST /tasks/:id/portal-stage เท่านั้น'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_portal_stage ON tasks;
CREATE TRIGGER guard_portal_stage
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION guard_portal_stage();

-- ── 5) กฎข้อ 12 · ทุก tenant ต้องมี owner อย่างน้อยหนึ่งคน ─────────
-- บังคับด้วย trigger ไม่ใช่แค่โค้ดฝั่งแอป
CREATE OR REPLACE FUNCTION guard_last_owner() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  target_tenant uuid;
  owners_left int;
BEGIN
  target_tenant := COALESCE(OLD.tenant_id, NEW.tenant_id);

  SELECT count(*) INTO owners_left
  FROM memberships
  WHERE tenant_id = target_tenant
    AND role = 'owner'
    AND deactivated_at IS NULL
    AND id <> OLD.id;

  -- ถ้าแถวใหม่ยังเป็น owner ที่ใช้งานอยู่ ก็ยังนับเป็นหนึ่งคน
  IF TG_OP = 'UPDATE' AND NEW.role = 'owner' AND NEW.deactivated_at IS NULL THEN
    owners_left := owners_left + 1;
  END IF;

  IF owners_left = 0 THEN
    RAISE EXCEPTION 'ที่ทำงานต้องมีเจ้าของอย่างน้อยหนึ่งคนเสมอ (กฎข้อ 12)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS guard_last_owner ON memberships;
CREATE TRIGGER guard_last_owner
  AFTER UPDATE OR DELETE ON memberships
  FOR EACH ROW
  WHEN (OLD.role = 'owner')
  EXECUTE FUNCTION guard_last_owner();

-- ── 6) กฎข้อ 8 · บอร์ดตั้งได้ 2–8 คอลัมน์ ─────────────────────────
-- บังคับที่ฐานข้อมูลด้วย ไม่ใช่แค่ validateColumns() ฝั่งแอป
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_board_size;
ALTER TABLE projects ADD CONSTRAINT projects_board_size
  CHECK (jsonb_array_length(board) BETWEEN 2 AND 8);

-- การ์ดต้องอยู่ในคอลัมน์ที่มีอยู่จริงบนบอร์ดของโปรเจกต์นั้น
CREATE OR REPLACE FUNCTION guard_column_exists() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE ok boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM projects p, jsonb_array_elements(p.board) c
    WHERE p.id = NEW.project_id AND c->>'key' = NEW.column_key
  ) INTO ok;

  IF NOT ok THEN
    RAISE EXCEPTION 'คอลัมน์ % ไม่มีอยู่บนบอร์ดของโปรเจกต์นี้', NEW.column_key
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_column_exists ON tasks;
CREATE TRIGGER guard_column_exists
  BEFORE INSERT OR UPDATE OF column_key, project_id ON tasks
  FOR EACH ROW EXECUTE FUNCTION guard_column_exists();

-- ── 7) ทางเข้าสำหรับสี่ endpoint ตามกฎข้อ 11 ─────────────────────
--
-- ปัญหา: /me/workspaces ต้องอ่าน memberships ข้ามทุกที่ทำงาน
-- แต่ policy tenant_isolation บล็อกไว้หมดเมื่อไม่ได้ตั้ง app.tenant_id
--
-- ทางออกที่ **ไม่** เลือก — ให้แอปเชื่อมด้วย role ที่ BYPASSRLS ตอนเรียกสี่เส้นทางนี้
-- เพราะพอมี role ที่ข้ามได้ วันหนึ่งจะมีคนใช้มันในที่ที่ไม่ควร แล้วไม่มีใครรู้
--
-- ทางออกที่เลือก — เพิ่ม policy ที่แคบที่สุดเท่าที่จะเป็นไปได้
-- "เห็นได้เฉพาะแถวที่เป็นของตัวเอง" ซึ่งเป็นข้อมูลที่เจ้าตัวรู้อยู่แล้ว
--
-- สำคัญ: app.user_id ถูกตั้งเฉพาะใน withAccount() เท่านั้น
-- ใน withTenant() ค่านี้เป็น NULL เงื่อนไข OR จึงไม่มีทางเป็นจริง
-- ที่ทำงานหนึ่งจึงไม่มีวันเห็นว่าใครไปอยู่ที่ทำงานไหนอีกบ้าง
CREATE OR REPLACE FUNCTION current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION current_user_email() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_email', true), '')
$$;

DROP POLICY IF EXISTS tenant_isolation ON memberships;
CREATE POLICY tenant_isolation ON memberships
  USING (
    tenant_id = current_tenant_id()
    -- GET /me/workspaces · POST /workspaces/:id/leave — เห็นเฉพาะแถวของตัวเอง
    OR (current_user_id() IS NOT NULL AND user_id = current_user_id())
  )
  -- เขียนยังบังคับให้อยู่ในที่ทำงานที่กำลังทำงานอยู่เสมอ ไม่มีข้อยกเว้น
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation ON invitations;
CREATE POLICY tenant_isolation ON invitations
  USING (
    tenant_id = current_tenant_id()
    -- GET /me/invitations — เฉพาะคำเชิญที่ส่งถึงอีเมลนี้
    OR (current_user_email() IS NOT NULL AND email = current_user_email())
    -- GET /invitations/:token — ต้องอ่านได้ทั้งตอนยังไม่ล็อกอิน (หน้าจอ 05)
    -- และตอนล็อกอินด้วยอีเมลที่ไม่ตรง (หน้าจอ 44 ต้องบอกได้ว่าให้สลับไปบัญชีไหน)
    --
    -- ปลอดภัยเพราะต้องรู้โทเคนถึงจะคำนวณ hash นี้ได้ — การถือโทเคนคือสิทธิ์ในตัวมันเอง
    -- และเปิดได้ทีละแถวเท่านั้น ไล่ดูคำเชิญของคนอื่นไม่ได้
    OR (
      NULLIF(current_setting('app.invite_token_hash', true), '') IS NOT NULL
      AND token_hash = current_setting('app.invite_token_hash', true)
    )
  )
  WITH CHECK (tenant_id = current_tenant_id());

-- POST /workspaces สร้างที่ทำงานใหม่ — tenants ไม่มี tenant_id จึงไม่มี RLS อยู่แล้ว
-- แต่แถว memberships ของเจ้าของคนแรกต้องเขียนได้ ตัวเรียกจึงต้องตั้ง app.tenant_id
-- เป็น id ของที่ทำงานที่เพิ่งสร้าง ก่อนเขียนแถวนั้น (ดู createWorkspace ใน accounts.ts)
