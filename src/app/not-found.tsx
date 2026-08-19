import Link from 'next/link';

/** ทุกกรณีที่เข้าไม่ได้ต้องเป็น 404 ไม่ใช่ 403 — 403 ยืนยันว่าข้อมูลนั้นมีอยู่จริง */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-lg font-semibold text-ink">ไม่พบหน้านี้</h1>
      <p className="text-sm text-muted">ลิงก์อาจผิด หรือคุณไม่มีสิทธิ์เข้าถึงที่ทำงานนี้</p>
      <Link href="/" className="text-sm text-brand hover:underline">
        กลับไปเลือกที่ทำงาน
      </Link>
    </main>
  );
}
