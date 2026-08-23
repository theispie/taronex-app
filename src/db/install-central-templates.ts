/**
 * ติดตั้งแม่แบบกลาง — รันด้วย role เจ้าของตาราง
 *
 * แม่แบบกลางมี `tenant_id = NULL` ซึ่ง RLS ปฏิเสธการเขียนจากฝั่งแอปเสมอ
 * (`WITH CHECK (tenant_id = current_tenant_id())`) จึงต้องติดตั้งจากตรงนี้
 * เป็นการตั้งใจ — ไม่มีทางที่ผู้ใช้คนไหนจะแก้แม่แบบกลางได้ผ่านแอป
 *
 * รันซ้ำได้ · เทียบด้วยชื่อ ถ้ามีอยู่แล้วจะอัปเดตเนื้อในให้ตรงกับโค้ด
 */

import { and, eq, isNull } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/postgres-js';
import { CENTRAL_TEMPLATES } from './central-templates';
import type * as schema from './schema';
import { projectTemplates } from './schema';

type Db = ReturnType<typeof drizzle<typeof schema>>;

export async function installCentralTemplates(db: Db): Promise<number> {
  for (const t of CENTRAL_TEMPLATES) {
    const existing = await db
      .select({ id: projectTemplates.id })
      .from(projectTemplates)
      .where(and(isNull(projectTemplates.tenantId), eq(projectTemplates.name, t.name)))
      .limit(1);

    if (existing[0]) {
      await db
        .update(projectTemplates)
        .set({ description: t.description, definition: t.definition })
        .where(eq(projectTemplates.id, existing[0].id));
    } else {
      await db.insert(projectTemplates).values({
        tenantId: null,
        name: t.name,
        description: t.description,
        definition: t.definition,
      });
    }
  }
  return CENTRAL_TEMPLATES.length;
}
