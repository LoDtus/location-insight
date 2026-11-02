# Mô hình đe dọa — PWA (015-pwa)

STRIDE; phần push và dữ liệu máy chủ xem `014-notification/threat-model.md`. Ranh giới: trang ↔ service worker ↔ mạng ↔ dịch vụ push.

| ID | Loại | Mối đe dọa | Biện pháp | Mức còn lại |
| --- | --- | --- | --- | --- |
| P1 | Information disclosure | Bộ nhớ đệm chứa HTML/API của người dùng đã đăng xuất, thiết bị dùng chung | Không lưu đệm HTML đã xác thực, `/api/**`; chỉ tài nguyên tĩnh công khai; `LOGOUT` xóa bộ nhớ đệm | Thấp |
| P2 | Tampering | Chèn mã vào `sw.js` (XSS, tệp bị sửa) kiểm soát mọi yêu cầu | `sw.js` phục vụ cùng origin, `Content-Type: text/javascript`, không `importScripts` ngoài, CSP `script-src` chặt, tệp sinh từ CI có băm; không nhận tham số truy vấn tạo SW | Trung bình (SW bị chiếm là nghiêm trọng; phụ thuộc CSP và XSS toàn trang) |
| P3 | Spoofing | Trang lạ gửi `postMessage` tới cửa sổ giả `navigate` | Trang chỉ nhận thông điệp từ `navigator.serviceWorker`, kiểm `url` cùng origin và nằm trong `/app/` hoặc `/admin/` | Thấp |
| P4 | Open redirect | `url` trong payload/`notificationclick` dẫn ra ngoài | SW dựng `new URL(url, self.location.origin)`, so `origin`, kiểm tiền tố; sai thì mở `/app/notification` | Thấp |
| P5 | Denial of service | SW bị lỗi khiến cả ứng dụng không tải (kẹt phiên bản hỏng) | Không can thiệp điều hướng HTML (network-only); cập nhật theo byte; có "đường thoát": truy vấn `?no-sw=1` gọi hủy đăng ký, và trang hướng dẫn xóa dữ liệu trang | Thấp |
| P6 | Information disclosure | Thông báo hiển thị trên màn hình khóa lộ nội dung | Tùy chọn ẩn nội dung; loại nhạy cảm dùng nội dung ngắn | Trung bình |
| P7 | Privacy | Theo dõi người dùng qua `source=pwa`, số liệu cài đặt | Không PII, không định danh ổn định; số liệu tổng hợp | Thấp |
| P8 | Tampering | Manifest bị sửa để đổi `start_url`/`scope` | Phục vụ cùng origin, `manifest-src 'self'`; `scope: "/"` | Thấp |
| P9 | Elevation | SW của `/app` được phục vụ cho `/admin` | Một SW, nhưng không lưu đệm thứ gì riêng tư; quyền kiểm ở backend; không lưu token trong SW | Thấp |
| P10 | Supply chain | Công cụ build SW bị nhiễm | Ghim phiên bản, lockfile, `npm audit`; công cụ chỉ dev | Thấp |

## Kiểm tra trước phát hành

- Playwright: không có mục nào của `/api/**` hay trang `/app` trong `caches.keys()`.
- Kiểm tiêu đề `/sw.js`, `/manifest.webmanifest`, CSP.
- Kịch bản thiết bị dùng chung: A đăng nhập, bật push, đăng xuất, B đăng nhập; không thông báo của A hiện sau đó; thông báo cũ của A đã đóng.
