*Phiên bản 1.0 · Cập nhật ngày 26/10/2026*

Thỏa thuận này áp dụng khi Địa Thế cung cấp giao diện lập trình ứng dụng (API) cho bên khác. **Tại thời điểm công bố phiên bản này, Địa Thế chưa mở API công khai.** Tài liệu được đăng trước để quy tắc rõ ràng từ đầu; nó chỉ có hiệu lực với bạn khi Người vận hành cấp cho bạn khóa API và bạn chấp nhận thỏa thuận này.

## 1. Phạm vi

- Bạn được truy cập các điểm cuối (endpoint) và loại dữ liệu mà Địa Thế cho phép trong tài liệu API và trong khóa API được cấp. Quyền này là không độc quyền, không chuyển nhượng, có thể thu hồi.
- Địa Thế không cấp lại quyền đối với dữ liệu bên thứ ba vượt quá giấy phép gốc của dữ liệu đó. Một số dữ liệu có thể không có trong API vì lý do giấy phép.
- Thỏa thuận này bổ sung cho Điều khoản sử dụng. Khi có mâu thuẫn về việc dùng API, thỏa thuận này được ưu tiên.

## 2. Khóa API và bảo mật

- Khóa API là bí mật của bạn. Không công khai khóa, không nhúng khóa vào mã chạy phía người dùng cuối nếu điều đó làm lộ khóa.
- Bạn chịu trách nhiệm về mọi truy cập thực hiện bằng khóa của bạn. Nếu nghi khóa bị lộ, hãy báo ngay qua kênh liên hệ để thu hồi và cấp khóa mới.
- Mỗi bên sử dụng cần khóa riêng. Không chia sẻ khóa cho bên khác.

## 3. Giới hạn sử dụng

- API có giới hạn số yêu cầu theo thời gian và theo dung lượng. Mức giới hạn và đơn vị tính được nêu trong tài liệu API hoặc trong gói được cấp, và có thể được điều chỉnh với thông báo hợp lý.
- Bạn không được vượt giới hạn, không phân tán yêu cầu qua nhiều khóa để né giới hạn, không gây quá tải hệ thống.
- Nếu có phí, giá và thanh toán áp dụng theo tài liệu Giá, thanh toán và hoàn tiền hoặc theo thỏa thuận riêng bằng văn bản.

## 4. Điều bạn không được làm

- Sao chép hàng loạt, lưu trữ để xây dựng bản sao cơ sở dữ liệu, hoặc phân phối lại dữ liệu thô nhận từ API.
- Dùng API để xây dựng sản phẩm hoặc dịch vụ cạnh tranh trực tiếp với Địa Thế bằng chính dữ liệu của Địa Thế.
- Dùng API để thu thập hoặc suy đoán thông tin cá nhân của người dùng, hoặc vi phạm pháp luật.
- Bán lại quyền truy cập API, hoặc mô tả sai nguồn gốc dữ liệu.
- Tìm cách vượt qua cơ chế xác thực, giới hạn hoặc bảo mật.

## 5. Ghi nguồn

Khi hiển thị dữ liệu nhận từ API, bạn phải ghi nguồn Địa Thế và nguồn dữ liệu gốc theo yêu cầu trong tài liệu Nguồn dữ liệu. Bạn không được trình bày kết quả như thể là kết luận chính thức, định giá hay tư vấn của Địa Thế. Bạn tuân thủ Tuyên bố về dữ liệu phân tích khi trình bày kết quả cho người dùng của bạn.

## 6. Dữ liệu cá nhân

Nếu bạn xử lý dữ liệu cá nhân trong quá trình dùng API, bạn là bên chịu trách nhiệm tuân thủ pháp luật về bảo vệ dữ liệu cá nhân đối với việc xử lý đó. Hai bên sẽ bổ sung thỏa thuận xử lý dữ liệu riêng nếu Địa Thế phải xử lý dữ liệu cá nhân thay cho bạn.

## 7. Tình trạng dịch vụ và giới hạn trách nhiệm

API được cung cấp ở trạng thái hiện có. Địa Thế không cam kết thời gian hoạt động, độ chính xác hay độ đầy đủ của dữ liệu. Địa Thế có thể thay đổi, thay thế hoặc ngừng một phần API, nhưng sẽ nỗ lực thông báo trước ít nhất 30 ngày với thay đổi gây gián đoạn. Giới hạn trách nhiệm và bồi hoàn trong Điều khoản sử dụng áp dụng tương ứng cho việc dùng API, trong phạm vi pháp luật cho phép.

## 8. Thu hồi và chấm dứt

- Người vận hành có thể tạm ngưng hoặc thu hồi khóa ngay nếu có dấu hiệu lộ khóa, lạm dụng, vi phạm thỏa thuận hoặc pháp luật, hoặc theo yêu cầu của cơ quan có thẩm quyền hoặc của nhà cung cấp dữ liệu gốc.
- Bạn có thể ngừng dùng API bất kỳ lúc nào. Khi chấm dứt, bạn xóa khóa và dữ liệu đã lưu trữ trái phép, và các nội dung về ghi nguồn, bảo mật, giới hạn trách nhiệm vẫn có hiệu lực.
- Phần phí đã trả trước cho kỳ chưa sử dụng được hoàn khi Người vận hành chấm dứt mà không do lỗi vi phạm của bạn.

## 9. Luật áp dụng

Thỏa thuận chịu sự điều chỉnh của pháp luật Việt Nam. Tranh chấp giải quyết theo mục Luật áp dụng và giải quyết tranh chấp của Điều khoản sử dụng.
