# Thanh toán và quản lý gói (SePay)

**Feature ID:** 007-billing
**Type:** New Feature
**Status:** Ready for Planning

## Vấn đề <!-- key: problem -->

Người dùng thấy giá tại `/#bang-gia` nhưng chưa có cách trả tiền, nhận gói, gia hạn, hủy, yêu cầu hoàn hoặc được báo trước khi gói hết hạn. Chính sách thanh toán đã công bố cách làm với SePay, trong khi phân quyền chỉ nhận kết quả "gói nào đến ngày nào". Sản phẩm không phải tenant: một người chỉ được một gói cho chính mình, nhưng bản đặc tả trước vẫn cho hai hạng chạy cùng lúc và để admin thu hồi theo mã gói.

## Bối cảnh hiện tại <!-- key: current_context -->

Mục `/#bang-gia` niêm yết ba mức: miễn phí, không giới hạn lượt (30.000 đồng/tháng, 300.000 đồng/năm), có định giá (60.000 đồng/tháng, 600.000 đồng/năm), và định giá lẻ 10.000 đồng/lần. Trang ghi giá là mức minh họa và chưa thu tiền. `004-rbac` đã có `subscriptions` (nguồn `payment` hoặc `admin_grant`) và sổ tín dụng định giá. `005-legal` và `chinh-sach-thanh-toan.md` đã chốt: SePay bằng chuyển khoản hoặc QR, không tự gia hạn, hoàn tiền trong các trường hợp đã liệt kê. Chưa có đơn hàng, webhook, màn thanh toán hay thông báo hết hạn.

## Mục tiêu <!-- key: goal -->

Một người đã đăng nhập trả đúng số tiền, đúng nội dung, thì đúng một gói hoặc một lượt định giá có hiệu lực ngay. Họ xem được hạn, gia hạn hoặc đổi gói theo quy tắc một gói, hủy mà vẫn dùng đến hết hạn đã trả, rút lại lệnh hủy trước ngày đó, và được nhắc trước khi hết hạn. Người vận hành tìm một người, thấy gói đang mở của người đó, cấp hoặc kết thúc gói đó, đối soát giao dịch lệch và ghi nhận hoàn tiền. Không lưu thông tin đăng nhập ngân hàng.

## Phạm vi <!-- key: scope -->

**In scope:**

- Đơn mua gói tháng hoặc năm, và đơn mua một lượt định giá, xuất phát từ bảng giá.
- Mã QR và nội dung chuyển khoản do SePay/VietQR điền sẵn số tiền.
- Webhook SePay: đủ tiền, thiếu tiền, thừa tiền, sai nội dung, tiền ra, gửi lại, đến muộn, giả mạo.
- Kích hoạt hoặc cộng hạn `subscriptions` và cộng tín dụng định giá, rồi xóa cache quyền như `004-rbac`.
- Đúng một gói đang mở cho mỗi người. Gia hạn cùng hạng nối hạn. Lên hạng thì gói cũ đóng lúc gói mới có hiệu lực. Xuống hạng khi gói đắt hơn còn hạn thì bị từ chối.
- Hủy gói (còn dùng đến `period_end`), rút lại lệnh hủy trước ngày đó, thu hồi ngay bởi admin, yêu cầu hoàn và ghi nhận đã chuyển trả.
- Admin tìm một người rồi xem, cấp hoặc kết thúc đúng gói đang mở của người đó. Cấp đè lên gói còn hạn bị từ chối.
- Nhắc gia hạn trong ứng dụng trước 7 ngày, 1 ngày và đúng ngày hết hạn. Không tự trừ tiền.
- Màn người dùng và màn đối soát cho người vận hành.

**Out of scope (non-goals):**

- Tenant, tổ chức, ghế, số lượng thành viên, gán gói cho người khác.
- Hai gói trả phí chạy cùng lúc, prorate, mã giảm giá, kho phương thức thanh toán.
- Thu tiền thật trong bản đặc tả này, và không gọi SePay từ môi trường dev nếu chưa có khóa.
- Thẻ quốc tế, ví điện tử, trừ tiền định kỳ, hóa đơn điện tử tự động.
- Đổi giá đã niêm yết. Catalog lấy số đang có trên `/#bang-gia`.
- Sửa ma trận quyền trong `authorization.config.ts`.

## Tiêu chí thành công <!-- key: success_criteria -->

- Chọn gói trên bảng giá dẫn tới một đơn, một mã, một số tiền. Quét QR hoặc chuyển khoản đúng mã và đủ tiền thì gói hoặc lượt định giá có hiệu lực, và người dùng thấy biên lai.
- Cùng một giao dịch SePay gửi nhiều lần không kích hoạt hai lần.
- Thiếu tiền, sai mã, hết hạn đơn, hoặc webhook không xác thực được thì không mở quyền.
- Hủy không cắt ngày đã trả. Rút lại lệnh hủy trước ngày đó thì gói trở lại như chưa hủy. Thu hồi và hoàn tiền đã duyệt thì quyền hết ngay và cache quyền bị xóa.
- Một người không có hai gói trả phí cùng lúc. Lượt định giá mua lẻ không tính là gói thứ hai.
- Admin làm việc trên một người, không cần biết trước mã gói. Cấp gói khi người đó còn hạn trả phí thì bị từ chối.
- Trước ngày hết hạn có thông báo trong ứng dụng. Không có lệnh trừ tiền tự động.

## Đối tượng sử dụng chính & Kịch bản sử dụng <!-- key: primary_actors -->

- **Người dùng đã đăng nhập:** mua đúng một gói cho mình hoặc một lượt định giá, chờ xác nhận, gia hạn, đổi hạng, hủy, rút lại lệnh hủy, xin hoàn, xem lịch sử.
- **Khách chưa đăng nhập:** chỉ xem bảng giá. Bấm trả tiền thì tới đăng nhập, rồi quay lại đơn.
- **SePay:** gửi webhook khi có giao dịch ngân hàng.
- **Người vận hành (admin):** tìm một người, xem gói đang mở của người đó, cấp gói khi họ đang miễn phí, kết thúc gói đó, đối soát lệnh lệch, chấp thuận hoặc từ chối hoàn, ghi đã chuyển tiền trả.
- **Job nhắc hạn:** mỗi sáng tạo thông báo 7 ngày, 1 ngày và đúng ngày hết hạn.

## Nơi bị ảnh hưởng <!-- key: impacted_areas -->

- Website: `/#bang-gia` nối tới luồng trả tiền; khu tài khoản có trang gói và trang chờ thanh toán.
- Backend: module thanh toán mới, gọi sang bảng `subscriptions` và `credit_ledger_entries` của `004-rbac`, rồi phát `events:authz:changed`.
- PostgreSQL cho đơn, giao dịch, yêu cầu hoàn, thông báo. Redis chỉ cho khóa ngắn và giới hạn tần suất tạo đơn.

## Phụ thuộc <!-- key: dependencies -->

- `003-auth`: phải có phiên. Webhook không dùng phiên người dùng.
- `004-rbac`: gói hiệu lực là bản ghi `subscriptions` còn hạn, hạng cao hơn thắng. Tín dụng định giá nằm ở sổ cái.
- `005-legal`: lời trên màn thanh toán không được trái `chinh-sach-thanh-toan.md`.

## Dữ liệu nhạy cảm & Tuân thủ <!-- key: data_sensitivity -->

Có dữ liệu thanh toán: số tiền, mã đơn, nội dung chuyển khoản, mã tham chiếu ngân hàng, thời điểm. Không lưu số thẻ, mật khẩu ngân hàng hay OTP. Số tài khoản thụ hưởng là của người vận hành, để trong biến môi trường. Ảnh QR chỉ nhúng URL VietQR, không tải về để lưu. Hoàn tiền ghi số tài khoản người nhận do chính họ cung cấp lúc xin hoàn, và chỉ admin đọc được.

## Ràng buộc <!-- key: constraints -->

- SePay xác nhận bằng webhook. Trả `HTTP 200` hoặc `201` và đúng `{"success": true}` trong 30 giây. Sai body là thất bại dù đã nhận.
- Không tự gia hạn, không tự trừ tiền. Nếu sau này có trừ tự động thì phải bật tay, báo trước ít nhất 7 ngày, và hủy được.
- Giá một lần trả là giá đang niêm yết lúc tạo đơn. Đổi giá sau đó không sửa đơn đã tạo và không sửa hạn đã trả.
- Phí chuyển khoản của ngân hàng người trả tự chịu. Hệ thống chỉ đối chiếu số tiền SePay báo đã vào tài khoản thụ hưởng.
- Hoàn tiền là người vận hành chuyển khoản trả. SePay bản chuyển khoản không có API hoàn thẻ.

## Rủi ro & Điểm chưa rõ <!-- key: risks_unknowns -->

- Chuyển thiếu hoặc sai nội dung là trường hợp hay gặp. Nếu kích hoạt khi thiếu tiền sẽ lỗ. Nếu không có màn "còn thiếu" thì người dùng tưởng hệ thống nuốt tiền.
- Webhook giả có thể mở gói không mất tiền nếu chỉ tin body JSON.
- Hai request mua cùng lúc có thể tạo hai dòng gói nếu không khóa theo người trong cùng transaction.
- Giao dịch đến sau khi đơn hết hạn cần người đối soát, không được tự mở quyền.

## Giả định (Assumptions) <!-- key: assumptions -->

- Số trên `/#bang-gia` là catalog làm việc của bản này, dù trang đích đang ghi là mức minh họa. Đổi số sau này chỉ sửa một catalog.
- "Năm bằng 10 tháng" là cách tính giá (300.000 và 600.000), còn thời hạn dùng là 365 ngày. Tháng là 30 ngày, tính từ lúc webhook ghi nhận đủ tiền.
- Một người chỉ có một gói đang mở. Cách đổi hạng nằm ở `research.md` Bản ghi quyết định 4. Giả định cũ "hai hạng chạy chồng, hạng cao thắng" không còn dùng.
- Lượt định giá mua lẻ vẫn là sổ tín dụng, không phải gói thứ hai.
- Một giao dịch vào được tính là đủ khi `transferAmount` lớn hơn hoặc bằng số tiền đơn, đúng mã, đúng tài khoản thụ hưởng, `transferType = in`. Phần thừa ghi vào đơn để xin hoàn phần thừa, không tự chuyển trả.
- Mã thanh toán là tiền tố `DT` cộng 8 ký tự hex ngẫu nhiên. SePay cấu hình mẫu này để điền trường `code`.
- Nhắc hạn chỉ trong ứng dụng ở bản này. Email gửi sau, khi đã có kênh thư thật. Dev không gửi thư.
- "Đã dùng quyền lợi" nghĩa là sau lúc thanh toán có ít nhất một lượt phân tích bị trừ hạn mức, hoặc một bút toán `use` của tín dụng định giá. Chưa có bảng lịch sử phân tích thì hàm này trả chưa dùng, và được nối sau.

## Câu hỏi mở (Open Questions) <!-- key: open_questions -->

- Thời hạn "năm" là 365 ngày hay đúng 10 tháng sử dụng? Bản này giả định 365 ngày.
- Có bắt buộc tài khoản ảo (VA) theo ngân hàng SePay sẽ ký không? Bản này dùng tài khoản trong cấu hình và không khóa một ngân hàng.

## Tính năng liên quan <!-- key: related_features -->

- `001-ui`: ngôn ngữ hình ảnh của mock.
- `003-auth`: phiên đăng nhập trước khi tạo đơn.
- `004-rbac`: nơi ghi gói và tín dụng sau khi thu tiền.
- `005-legal`: chính sách giá, hủy, hoàn.
- `006-buying`: không bán nhà đất. Thanh toán ở đây chỉ là phí phần mềm.

## Nhật ký cập nhật <!-- key: update_log -->

- Tạo từ mục `/#bang-gia`, chính sách thanh toán đã công bố, và tài liệu webhook/VietQR trên developer.sepay.vn. Người dùng yêu cầu đủ các tình huống thanh toán và quản lý gói, kèm đặc tả và UI.
- Khóa một gói cho một người, không phải tenant. Đối chiếu Stripe Customer Portal (một subscription, hủy cuối kỳ, rút lại hủy, đổi gói) và trang giới hạn một subscription của Stripe. Bỏ chồng hạng. Admin quản lý theo người.
