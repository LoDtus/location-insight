# Phân quyền theo vai trò và gói (Authorization / RBAC)

**Feature ID:** 004-rbac
**Type:** New Feature
**Status:** Ready for Planning

## Vấn đề <!-- key: problem -->

Địa Thế có ba nhóm người dùng (khách, người dùng, quản trị), và người dùng lại chia theo gói trả phí với quyền và hạn mức khác nhau. Chưa có nơi nào quyết định ai được làm gì, ai còn bao nhiêu lượt phân tích, và ai mở được bước định giá. Nếu để rải rác trong từng API thì dễ sót, khó kiểm tra và khó đổi khi bảng giá thay đổi.

## Bối cảnh hiện tại <!-- key: current_context -->

- Chưa có guard, decorator hay cấu hình phân quyền trong `backend/` (mới có `UserModule` mẫu).
- Trang giá ở landing (`website/src/features/landing-page/locales/vi.json`) đã mô tả ba gói: **Miễn phí** (khoảng 10 lượt so sánh mỗi ngày, chỉ xem điểm mạnh/điểm yếu, chưa định giá), **Không giới hạn lượt** (30.000 đồng/tháng, không giới hạn lượt, định giá mua lẻ 10.000 đồng/lần), **Có định giá** (60.000 đồng/tháng, thêm bước định giá). Giá còn là minh họa.
- `006-buying/ui.md` đã nêu khách xem được chi tiết tin nhưng một số hành động (liên hệ, lưu, phân tích) cần đăng nhập; khung phân tích hiện lượt còn lại theo ngày.
- `security.md`: deny-by-default, `@Public()` cho route công khai, backend là nơi duy nhất thực thi quyền, 403/404 nhất quán để chống dò.
- `003-auth` cung cấp danh tính, `sid`, và bộ đệm `cache:authz:{userId}`.

## Mục tiêu <!-- key: goal -->

Một bảng quyền duy nhất, viết cứng trong mã backend, trả lời mọi câu hỏi "người này được làm việc này không và còn bao nhiêu lượt", áp dụng nhất quán cho mọi API, nhanh (không thêm truy vấn DB trên đường nóng), kiểm thử được tự động và đổi bảng giá chỉ bằng một lần sửa-review-triển khai.

## Phạm vi <!-- key: scope -->

**In scope:**

- Ba vai trò: `guest`, `user`, `admin`. Người dùng có thêm gói: `free`, `unlimited`, `valued`.
- Quyền dạng `resource:action`, ánh xạ vai trò → quyền và gói → quyền/hạn mức, viết cứng trong file cấu hình backend.
- Hạn mức theo ngày (lượt phân tích) và giới hạn số lượng (địa điểm đã lưu, tin đang đăng).
- Quyền theo chủ sở hữu tài nguyên (tin của tôi, ghi chú của tôi).
- Tín dụng định giá mua lẻ (10.000 đồng/lần) như một quyền kèm số dư.
- Gói có thời hạn: hết hạn tự quay về `free`.
- Quyền quản trị: người dùng, khóa tài khoản, cấp gói thủ công, kiểm duyệt tin, bài viết, nhật ký kiểm toán.
- Endpoint trả quyền hiệu lực cho frontend (chỉ để hiển thị).
- Kiểm thử tự động tính nhất quán của bảng quyền và kiểm kê route.

**Out of scope (non-goals):**

- Phân quyền động: không giao diện quản lý vai trò, không bảng `roles`/`permissions` trong DB, không cấp quyền riêng cho từng người ngoài việc đổi gói.
- Thanh toán, hóa đơn, xử lý SePay (tính năng thanh toán riêng; ở đây chỉ nhận kết quả "gói X đến ngày Y").
- Nhiều tổ chức (multi-tenant), nhóm, chia sẻ tài nguyên giữa người dùng.
- Vai trò trung gian (moderator, biên tập viên): thêm sau bằng cách sửa cấu hình.
- Quản lý danh tính, phiên, đăng nhập (`003-auth`).

## Tiêu chí thành công <!-- key: success_criteria -->

- Không có route nào chạy mà không khai báo rõ ai được gọi (kiểm kê tự động).
- Thêm hoặc đổi một quyền, một hạn mức chỉ là sửa một file cấu hình, có test chặn sai sót.
- Kiểm tra quyền không thêm truy vấn DB trên đường nóng; thêm ≤ 0,2 ms CPU và không thêm vòng mạng so với kiểm tra phiên.
- Người dùng nâng gói thì có hiệu lực ở request kế tiếp (dưới 2 giây), hạ gói hoặc bị khóa cũng vậy.
- Lượt phân tích không trừ hai lần khi thử lại và được hoàn khi phân tích lỗi.

## Đối tượng sử dụng chính & Kịch bản sử dụng <!-- key: primary_actors -->

- **Khách:** xem trang công khai và chi tiết tin; bấm phân tích thì được mời đăng nhập.
- **User gói Miễn phí:** dùng 10 lượt/ngày; hết lượt thấy thông báo "làm mới lúc 00:00"; bấm định giá thì thấy lời mời nâng gói hoặc mua lẻ.
- **User gói Không giới hạn lượt / Có định giá:** không bị trần lượt; chỉ gói Có định giá (hoặc người có tín dụng) chạy định giá.
- **Admin:** khóa tài khoản vi phạm, cấp gói thủ công khi có sự cố thanh toán, gỡ tin.
- **Người vận hành:** đổi bảng giá/hạn mức bằng sửa cấu hình rồi triển khai.

## Nơi bị ảnh hưởng <!-- key: impacted_areas -->

- `backend`: module `rbac` (cấu hình, guard, decorator, bộ đếm hạn mức), mọi controller; module `admin`.
- `website`: `Can`/hook quyền (chỉ hiển thị), trang giá, bảng "lượt còn lại", chuyển hướng `/admin/*`, trạng thái hết lượt trong khung phân tích.
- PostgreSQL: `subscriptions`, `credit_ledger_entries`, `admin_audit_logs`. Redis: bộ đếm hạn mức.
- `003-auth`: `cache:authz` mang vai trò và gói.
- `005-legal`: điều khoản gói và hoàn tiền phải khớp hạn mức thực tế.

## Phụ thuộc <!-- key: dependencies -->

- Cần `003-auth` hoàn thành phần danh tính và `cache:authz`.
- Chặn các tính năng cần giới hạn: phân tích vị trí, định giá, lưu địa điểm, đăng tin, bình luận.
- Liên quan thanh toán (SePay) để ghi `subscriptions`; có thể nhập tay qua admin trước.

## Dữ liệu nhạy cảm & Tuân thủ <!-- key: data_sensitivity -->

Vai trò, gói, trạng thái thanh toán, nhật ký hành động admin, danh sách người dùng (PII) mà admin xem được. Cần nguyên tắc tối thiểu quyền cho admin và nhật ký kiểm toán. Phân tích sâu trong `threat-model.md`.

## Ràng buộc <!-- key: constraints -->

- Quyền hardcode trong file cấu hình cứng ở backend; không phân quyền động.
- Backend là nơi duy nhất thực thi; frontend chỉ phản chiếu để hiển thị.
- Mặc định từ chối; chỉ mở khi khai báo rõ.
- Hiệu năng: không thêm truy vấn DB hay vòng Redis riêng cho kiểm tra quyền.
- Số liệu gói trong landing còn là minh họa; cấu hình phải đổi được mà không đổi cấu trúc.

## Rủi ro & Điểm chưa rõ <!-- key: risks_unknowns -->

- Bảng giá chưa chốt: con số hạn mức trong cấu hình là giả định.
- Hạn mức giữ trong Redis: mất Redis có thể cho người dùng thêm lượt (chấp nhận; giảm bằng nạp lại từ lịch sử phân tích).
- Hai kênh cấp gói (thanh toán tự động và admin) có thể chồng nhau; cần quy tắc gói hiệu lực.
- Admin có quyền lớn nên là mục tiêu: cần step-up và kiểm toán.

## Giả định (Assumptions) <!-- key: assumptions -->

- A1. Hạn mức phân tích: Free 10 lượt/ngày; Unlimited và Valued không giới hạn. "So sánh" dùng chung bộ đếm với phân tích (mỗi địa điểm thêm vào để so sánh là một lượt).
- A2. Khách không được chạy phân tích (tốn tiền gọi model); chỉ xem dữ liệu minh họa.
- A3. Giới hạn số lượng (minh họa): lưu địa điểm 20 / 200 / 200; tin đang đăng 3 / 10 / 10; lịch sử phân tích giữ 30 / 365 / 365 ngày.
- A4. Admin được hưởng quyền như gói `valued` và không bị tính lượt; admin không tự cấp quyền cho mình hay quản lý admin khác qua API.
- A5. Định giá mua lẻ 10.000 đồng/lần cho mọi gói; dùng `credit_ledger_entries`.
- A6. Mốc ngày reset hạn mức là 00:00 `Asia/Ho_Chi_Minh`.
- A7. Hết hạn gói thì quay về `free` ngay; dữ liệu nhiều hơn giới hạn vẫn giữ, chỉ không cho tạo mới.
- A8. Khi gói hết hạn đang giữa một lượt phân tích đã bắt đầu, lượt đó vẫn hoàn tất.

## Câu hỏi mở (Open Questions) <!-- key: open_questions -->

- Q1. Chốt bảng giá và hạn mức thật (A1, A3).
- Q2. "So sánh" có tính lượt riêng, hay chỉ tính lượt khi chạy phân tích mới? (Đề xuất: chỉ tính khi chạy phân tích mới; so sánh các kết quả đã có thì miễn phí.)
- Q3. Có cho khách một lượt dùng thử cố định mỗi ngày theo IP không? (Đề xuất: không.)
- Q4. Đã chốt ở `007-billing/research.md` Bản ghi quyết định 4: một gói đang mở. Cùng hạng nối hạn. Lên hạng đóng dòng cũ, không hoàn ngày còn lại. Xuống hạng khi còn hạn thì từ chối.
- Q5. Thông tin liên hệ người đăng tin: khách có thấy không? (Đề xuất: ẩn với khách, hiện khi đăng nhập, để chống thu thập hàng loạt.)

## Tính năng liên quan <!-- key: related_features -->

- `003-auth`, `005-legal`, `006-buying`, `001-ui`, `002-landing-page` (trang giá).

## Nhật ký cập nhật <!-- key: update_log -->

- 26/10/2026: tạo bản đầu từ yêu cầu của chủ dự án (3 vai trò, gói, hardcode); số liệu hạn mức lấy từ trang giá minh họa của landing.
- 01/11/2026: Q4 đóng bằng quyết định một gói đang mở của `007-billing`.
