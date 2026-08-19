import Link from 'next/link';

/** ทุกกรณีที่เข้าไม่ได้ต้องเป็น 404 ไม่ใช่ 403 — 403 ยืนยันว่าข้อมูลนั้นมีอยู่จริง */
export default function NotFound() {
  return (
    <div className="auth-wrap">
      <div className="auth-box" style={{ textAlign: 'center' }}>
        <h1 className="auth-h1">ไม่พบหน้านี้</h1>
        <p className="sub" style={{ marginBottom: 20 }}>
          ลิงก์อาจผิด หรือคุณไม่มีสิทธิ์เข้าถึงที่ทำงานนี้
        </p>
        <Link href="/workspaces" className="btn btn-pri btn-lg">ไปหน้าเลือกที่ทำงาน</Link>
      </div>
    </div>
  );
}
