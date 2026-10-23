'use client';

import Link from 'next/link';

export default function AdminTriggerPage() {
  return (
    <div style={{ padding: '2rem', maxWidth: '700px', margin: '40px auto', background: '#14141e', color: '#f1f2f6', borderRadius: '12px', border: '1px solid #262638' }}>
      <h1 style={{ color: '#FFDE00', marginBottom: '1rem', fontSize: '1.8rem' }}>Bộ Điều Khiển Cào Dữ Liệu Đã Chuyển Về Local</h1>
      
      <div style={{ padding: '1rem', background: 'rgba(255, 222, 0, 0.1)', borderLeft: '4px solid #FFDE00', marginBottom: '1.5rem', borderRadius: '4px' }}>
        <p><strong>Lưu ý kiến trúc:</strong> Toàn bộ quy trình cào dữ liệu phim từ YouTube đã được tách rời khỏi máy chủ Serverless để tránh việc IP Datacenter bị chặn và lỗi quá thời gian thực thi (504 Timeout).</p>
      </div>

      <h3 style={{ marginBottom: '0.5rem', color: '#fff' }}>Hướng Dẫn Sử Dụng Bảng Điều Khiển Cục Bộ:</h3>
      <ol style={{ paddingLeft: '1.5rem', lineHeight: '1.8', color: '#ccc' }}>
        <li>Mở terminal trên máy cá nhân tại thư mục dự án.</li>
        <li>Chạy lệnh: <code style={{ background: '#000', padding: '2px 8px', borderRadius: '4px', color: '#2ed573' }}>npm run crawler:web</code></li>
        <li>Truy cập giao diện quản trị tại: <a href="http://localhost:4000" target="_blank" rel="noreferrer" style={{ color: '#1e90ff' }}>http://localhost:4000</a></li>
        <li>Nhấn nút <strong>&quot;Bắt Đầu Cào Dữ Liệu&quot;</strong> để quét phim qua mạng dân dụng (Residential IP).</li>
        <li>Nhấn <strong>&quot;Đồng Bộ Snapshot từ DB&quot;</strong> để cập nhật dữ liệu phim tức thì cho web chính.</li>
      </ol>

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <Link href="/" style={{ display: 'inline-block', padding: '10px 24px', background: '#262638', color: '#fff', textDecoration: 'none', borderRadius: '6px', fontWeight: 'bold' }}>
          Quay Về Trang Chủ Hanhan Movie
        </Link>
      </div>
    </div>
  );
}
