# Hướng dẫn cho agent (Claude Code)

Quy tắc dự án nằm trong `.cursor/rules/*.md` và `.cursor/skills/`; đọc trước khi sửa mã. Điểm đặc biệt cần nhớ:

- Công cụ `/reset` (xóa và dựng lại toàn bộ database) **chỉ dành cho máy dev**, tuyệt đối không được xuất hiện ở production. Xem `.cursor/rules/dev-reset.md`: không bật cờ ngoài `.env.development`, không gỡ các lớp bảo vệ, không chạy thay người dùng trên database dev của họ.
- Không đưa bí mật vào repo; biến môi trường chỉ sửa ở `.env*` gốc (xem `.cursor/rules/env-docker.md`).
- Không dùng `any`; kiểm tra đầu vào theo `.cursor/rules/security.md`.
