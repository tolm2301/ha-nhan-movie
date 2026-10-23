# Hanhan Movie

Nền tảng xem phim với kiến trúc Next.js App Router, quản lý dữ liệu linh hoạt qua PostgreSQL (Supabase) và tệp snapshot đệm `src/lib/movies.json`.

---

## 1. Kiến Trúc Thu Thập & Đồng Bộ Dữ Liệu (Local Crawler Architecture)

Toàn bộ quy trình cào dữ liệu từ YouTube được thực thi hoàn toàn tại **máy cục bộ (Local Residential IP)** qua ứng dụng Web điều khiển riêng biệt, không chạy trên Cloud Actions/Serverless để triệt tiêu lỗi giới hạn IP và timeout:

1. **Bộ Điều Khiển Cào Cục Bộ (`crawler-web/`)**:
   - Chạy trên cổng `4000` qua lệnh `npm run crawler:web`.
   - Cung cấp giao diện trực quan: Bắt đầu cào, theo dõi log thời gian thực qua Server-Sent Events (SSE), quản lý bật/tắt kênh và đồng bộ snapshot.
   - Quét video qua mạng dân dụng cá nhân, tự động lọc nội dung chuẩn (thời lượng > 600s, loại bỏ rác/shorts/recap), sau đó lưu trực tiếp vào PostgreSQL.
2. **Web Xem Phim Hanhan (`src/app/`)**:
   - Chạy trên cổng `3000` qua lệnh `npm run dev` hoặc triển khai trên Vercel.
   - Thuần túy đọc dữ liệu từ PostgreSQL hoặc tệp snapshot dự phòng `src/lib/movies.json`.
   - Hoạt động độc lập 100%, không phụ thuộc vào bất kỳ cron job cloud nào.

---

## 2. Cấu Hình Môi Trường Cục Bộ (.env.local)

Tạo hoặc cập nhật tệp `.env.local` với cấu hình kết nối trực tiếp cơ sở dữ liệu:

```env
# Chuỗi kết nối PostgreSQL Supabase Direct (Non-pooling)
POSTGRES_URL_NON_POOLING="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?sslmode=require"
DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?sslmode=require"
```

*Lưu ý: Nếu không có cấu hình cơ sở dữ liệu, toàn bộ hệ thống sẽ tự động fallback đọc từ tệp tĩnh `src/lib/movies.json`.*

---

## 3. Các Lệnh Thực Thi Chính (Scripts)

| Lệnh | Chức Năng |
| :--- | :--- |
| `npm run crawler:web` | **Khởi chạy Bảng Điều Khiển Cào Cục Bộ** tại `http://localhost:4000` |
| `npm run dev` | Khởi chạy máy chủ phát triển web xem phim tại `http://localhost:3000` |
| `npm run snapshot:movies`| Tạo/làm mới tệp đệm `src/lib/movies.json` từ PostgreSQL |
| `npm run migrate:movies` | Nạp dữ liệu ban đầu từ `movies.json` vào bảng PostgreSQL |
| `npm run crawl` | Chạy cào dữ liệu từ dòng lệnh (CLI) |
| `npm run crawl:dry` | Chạy thử nghiệm cào dữ liệu không lưu DB |
| `npm run build` | Build ứng dụng Next.js cho production (tự động chạy `prebuild` snapshot) |
| `npm run lint` | Kiểm tra cú pháp và quy chuẩn mã nguồn |

---

## 4. Triển Khai Lên Vercel (Production)

- **Framework Preset**: `Next.js`
- **Install Command**: `npm ci`
- **Build Command**: `npm run build`
- **Environment Variables**:
  - `POSTGRES_URL_NON_POOLING`: Chuỗi kết nối Supabase Direct URL.
