# HƯỚNG DẪN DỰ ÁN HANHAN MOVIE

## 1. TỔNG QUAN HỆ THỐNG
Dự án Hanhan Movie là nền tảng xem video, hoạt hình và phim chuyển thể tối ưu trải nghiệm người dùng với Next.js App Router, tự động thu thập dữ liệu đa nguồn từ YouTube, lưu trữ Postgres và cơ chế snapshot fallback độc lập.

## 2. QUY CHUẨN KỸ THUẬT VÀ PHÁT TRIỂN
- Framework: Next.js App Router, React 19, JavaScript hiện đại (ES Modules).
- Styling: Vanilla CSS, CSS Modules, CSS Variables. Không sử dụng thêm UI framework bên ngoài.
- Thành phần React: Tách biệt rõ ràng Server Component (SSR / Static params / SEO) và Client Component (Player tương tác, localStorage, UI state).
- Mã nguồn: Rõ ràng, tường minh, hàm thuần túy và async/await chuẩn xác.
- Bảo mật: Tuyệt đối không hardcode credentials trong code; toàn bộ kết nối cơ sở dữ liệu và API secrets quản lý qua biến môi trường.

## 3. QUẢN LÝ TÀI LIỆU VÀ TRI THỨC KIẾN TRÚC
Toàn bộ tài liệu phân tích, kiến trúc và kế hoạch phát triển được lưu tập trung trong thư mục `workplace/`:
- `workplace/PROJECT_BLUEPRINT.md`: Bản đồ vĩ mô (Kiến trúc phân tầng, domain model, quy ước chung, ADR).
- `workplace/codebase-md/`: Sơ đồ vi mô giải phẫu từng module (Call Graph, Execution Flow, API Contracts).
- `workplace/plans/`: Kế hoạch và lộ trình phát triển theo route.

Thư mục `workplace/` đã được cấu hình trong `.gitignore` để giữ lịch sử Git của dự án luôn sạch sẽ.

## 4. QUY TẮC NGÔN NGỮ VÀ TRÌNH BÀY
- Giữ sạch sẽ ngôn ngữ domain: Sử dụng đúng 100% bản chất nghiệp vụ (phim, danh mục, kênh, crawler, snapshot, player).
- Tuyệt đối không đưa ghi chú kỹ thuật thừa thãi, meta-tags hoặc thông tin triển khai vào tên tính năng và API.
- Không rò rỉ codename hoặc tên dự án ngoại lai.
- Trình bày ngắn gọn, máy móc, đúng nghiệp vụ, không thêm thắt.
