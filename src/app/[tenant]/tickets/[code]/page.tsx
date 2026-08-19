import { Stub } from '@/components/stub';

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <Stub
      screen="20"
      title={`ทิกเก็ต ${code}`}
      note="ลิ้นชักกับหน้าเต็มใช้คอมโพเนนต์เดียวกัน · ปุ่มการกระทำมีชื่อชัดเจน ไม่ใช่ dropdown เปลี่ยนสถานะ เพราะแต่ละการย้ายมีกติกาผูกอยู่"
    />
  );
}
