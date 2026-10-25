# Tài liệu pháp lý — Địa Thế

**Bối cảnh:** cá nhân vận hành, thị trường Việt Nam, có đăng tin BĐS, thanh toán online qua SePay, xác thực JWT + OAuth Google.

---

## Ranh giới cần chốt trước khi soạn bất kỳ tài liệu nào

**Địa Thế là công cụ đăng tin (classified ads), không phải sàn giao dịch BĐS.**
Theo Luật Kinh doanh BĐS 2023 Điều 62, vận hành sàn giao dịch BĐS phải là doanh nghiệp — cá nhân bị cấm. Địa Thế không kết nối giao dịch, không xác nhận pháp lý từng thửa, không thu hoa hồng, không đại diện các bên. Người mua và người bán tự liên hệ. Mỗi khi bổ sung tính năng mới (CTA, hỏi đáp, kết nối liên lạc) cần đánh giá lại ranh giới này.

**Điều kiện trước khi dùng SePay:**
SePay yêu cầu mã số thuế cá nhân kinh doanh (hoặc hộ kinh doanh). Cần đăng ký tại cục thuế địa phương trước khi tích hợp thanh toán.

**Điều kiện trước khi bật Google OAuth:**
Google không phê duyệt OAuth consent screen nếu chưa có trang chính sách quyền riêng tư công khai và trang điều khoản sử dụng.

---

## Nhóm A — Tài liệu công khai trên website

### 01 · Điều khoản sử dụng

**Khi nào:** trước khi mở đăng ký tài khoản.

**Nội dung cần có:**

- Mô tả rõ Địa Thế là công cụ tra cứu và đăng tin, không phải sàn giao dịch hay đơn vị môi giới BĐS
- Tài khoản: tạo, điều kiện sử dụng (đủ 18 tuổi hoặc có sự đồng ý của người giám hộ), đăng nhập qua email/Google, bảo mật mật khẩu, hủy tài khoản và xóa dữ liệu
- Phân tích địa điểm: kết quả là tham chiếu, không phải kết luận pháp lý hay tư vấn đầu tư
- Lưu địa điểm và ghi chú: dữ liệu cá nhân, chỉ người dùng xem được
- Đăng tin: người đăng tự chịu trách nhiệm toàn bộ về tính xác thực, quyền đăng tin và tình trạng pháp lý bất động sản
- Nội dung bị cấm: tin sai sự thật, hình ảnh vi phạm bản quyền, thông tin không có quyền sở hữu hoặc ủy quyền
- Bình luận và hỏi đáp: quy tắc ứng xử, nội dung bị cấm, quyền gỡ
- Quyền của Địa Thế: khóa, gỡ tin, tạm khóa tài khoản vi phạm, không cần thông báo trước trong trường hợp vi phạm nghiêm trọng
- Giới hạn trách nhiệm: Địa Thế không đảm bảo tính chính xác của dữ liệu phân tích, không chịu trách nhiệm về kết quả giao dịch giữa các bên
- Cơ chế giải quyết tranh chấp: liên hệ qua email trước, luật áp dụng là pháp luật Việt Nam

---

### 02 · Chính sách quyền riêng tư và bảo vệ dữ liệu cá nhân

**Khi nào:** trước khi mở đăng ký tài khoản. Căn cứ Luật BVDLCN 91/2025/QH15 và Nghị định 356/2025/NĐ-CP.

**Nội dung cần có:**

**Dữ liệu thu thập và nguồn gốc:**
- Đăng ký trực tiếp: tên, email, mật khẩu (hash), số điện thoại (nếu yêu cầu)
- Google OAuth: tên hiển thị, địa chỉ email, ảnh đại diện — ghi rõ đây là dữ liệu nhận từ Google, không lưu mật khẩu Google
- JWT token: dữ liệu mã hóa trong token (user ID, role, thời hạn), thời gian sống, cách thu hồi
- Dữ liệu sử dụng dịch vụ: địa chỉ tra cứu, tọa độ ghim, địa điểm đã lưu, ghi chú cá nhân, lịch sử phân tích, tin đăng
- Thanh toán: trạng thái giao dịch và mã đơn hàng từ SePay — không lưu số thẻ hay thông tin thanh toán nhạy cảm
- Nhật ký hệ thống: địa chỉ IP, loại thiết bị, thời gian truy cập

**Mục đích xử lý:**
- Cung cấp dịch vụ phân tích, đăng tin, lưu địa điểm
- Xác thực tài khoản và bảo mật
- Xử lý thanh toán qua SePay
- Cải thiện dịch vụ (chỉ dùng dữ liệu tổng hợp, không nhận dạng cá nhân)

**Bên nhận dữ liệu:**
- SePay: email, họ tên, số tiền để xử lý thanh toán
- Google: dữ liệu xác thực OAuth theo phạm vi được cấp phép
- Nhà cung cấp hosting/hạ tầng: truy cập kỹ thuật theo hợp đồng
- Không bán dữ liệu cho bên thứ ba

**Thời gian lưu giữ:**
- Dữ liệu tài khoản: đến khi người dùng xóa tài khoản, cộng tối đa 30 ngày xử lý
- Nhật ký hệ thống: tối đa 90 ngày
- Lịch sử giao dịch: 5 năm (nghĩa vụ kế toán, thuế)

**Quyền của người dùng:**
- Xem, tải, sửa dữ liệu cá nhân
- Xóa tài khoản và toàn bộ dữ liệu (trừ lịch sử giao dịch theo yêu cầu thuế)
- Rút đồng ý xử lý dữ liệu không bắt buộc
- Khiếu nại với Bộ Công an (cơ quan BVDLCN)
- Thời hạn phản hồi yêu cầu: tối đa 72 giờ

**Đầu mối liên hệ:** email cá nhân của người vận hành.

---

### 03 · Chính sách Cookie và đồng ý cookie

**Khi nào:** trước khi mở cho người dùng. Căn cứ Luật BVDLCN 2025.

**Lưu ý kỹ thuật:** cookie banner phải hoạt động thực sự — không đặt cookie theo dõi hành vi trước khi người dùng chấp nhận. Không chỉ là pop-up trang trí.

**Nội dung cần có:**

**Phân loại cookie:**

| Loại | Ví dụ | Cần đồng ý? |
| --- | --- | --- |
| Thiết yếu | Session, JWT refresh token, CSRF | Không — nhưng phải khai báo |
| Phân tích | Google Analytics, Hotjar (nếu dùng) | Có — trước khi đặt |
| Tùy chọn | Ghi nhớ ngôn ngữ, chế độ xem | Có |

**Cookie banner phải có:**
- Xuất hiện lần đầu truy cập, trước khi đặt cookie tùy chọn/phân tích
- Nút chấp nhận tất cả, từ chối tùy chọn/phân tích, và tùy chỉnh từng nhóm
- Lưu lựa chọn vào cookie thiết yếu
- Cho phép thay đổi lựa chọn bất kỳ lúc nào qua footer

**Nội dung chính sách cookie:**
- Danh sách cookie theo nhóm, tên cookie, mục đích, thời hạn, bên thứ ba nhận dữ liệu (Google, v.v.)
- Hướng dẫn xóa cookie trên từng trình duyệt phổ biến

---

### 04 · Chính sách đăng tin

**Khi nào:** trước khi mở tính năng đăng tin.

**Nội dung cần có:**

**Điều kiện đăng tin:**
- Phải có tài khoản đã xác thực email
- Người đăng phải là chủ sở hữu, người được ủy quyền hoặc môi giới có chứng chỉ (ghi rõ cách xác nhận nếu có)
- Không giới hạn số tin miễn phí / hoặc nêu rõ hạn mức theo gói

**Thông tin bắt buộc trong mỗi tin:**
- Loại giao dịch (bán/cho thuê), loại bất động sản
- Địa chỉ và tọa độ xấp xỉ
- Diện tích (m²), giá (VNĐ hoặc USD, nêu rõ đơn vị)
- Tình trạng pháp lý hiện tại
- Thông tin liên hệ của người đăng

**Nội dung bị cấm:**
- Giá, diện tích, địa chỉ sai lệch hoặc gây hiểu nhầm
- Đăng tin bất động sản không có quyền sở hữu hoặc ủy quyền
- Hình ảnh không liên quan, hình ảnh vi phạm bản quyền
- Nội dung quảng bá dịch vụ không liên quan đến bất động sản đang đăng
- Thông tin liên hệ giả mạo

**Quy trình và vòng đời tin:**
- Thời hạn tin (ví dụ: 30/60/90 ngày theo gói)
- Gia hạn thủ công hoặc tự động
- Xóa tin: người đăng tự xóa bất kỳ lúc nào; hệ thống xóa khi hết hạn
- Gỡ tin vi phạm: Địa Thế có quyền gỡ không cần thông báo trước nếu vi phạm rõ ràng

**Báo cáo vi phạm:**
- Nút "Báo cáo tin" trên mỗi tin
- Thời hạn xem xét và phản hồi

---

### 05 · Chính sách giá, thanh toán, hoàn tiền

**Khi nào:** trước khi tích hợp SePay và thu phí.

**Nội dung cần có:**

**Gói dịch vụ:**
- Danh sách gói, quyền lợi từng gói, giá VNĐ (bao gồm thuế nếu áp dụng)
- Thời hạn (tháng/năm), ngày bắt đầu tính từ khi thanh toán thành công
- Gói miễn phí: giới hạn lượt phân tích, không có định giá
- Gói trả phí: giới hạn được nới/bỏ tùy gói, mở định giá
- Định giá một lần: đơn giá theo lượt, không cần mua gói

**Thanh toán:**
- Cổng thanh toán: SePay (chuyển khoản ngân hàng, quét QR)
- Tiền tệ: VNĐ
- Thanh toán được xác nhận sau khi SePay xác nhận giao dịch thành công
- Không lưu thông tin thẻ hay tài khoản ngân hàng của người dùng

**Gia hạn và hủy:**
- Gói không tự gia hạn — người dùng phải chủ động gia hạn
- Hoặc: nếu có tự gia hạn, phải thông báo ít nhất 7 ngày trước khi trừ tiền và cho phép hủy
- Hủy gói: dịch vụ tiếp tục đến hết kỳ đã trả, không hoàn tiền phần còn lại

**Hoàn tiền:**
- Hoàn tiền trong vòng 24 giờ sau khi thanh toán nếu chưa sử dụng bất kỳ quyền lợi nào của gói
- Không hoàn sau 24 giờ hoặc sau khi đã sử dụng dịch vụ
- Hoàn tiền khi dịch vụ bị gián đoạn do lỗi kỹ thuật của Địa Thế kéo dài hơn 48 giờ liên tiếp

**Hóa đơn:**
- Xuất hóa đơn điện tử theo yêu cầu (ghi rõ quy trình yêu cầu hóa đơn)

---

### 06 · Tuyên bố về dữ liệu phân tích và giới hạn sử dụng

**Khi nào:** trước khi mở tính năng phân tích điểm mạnh/yếu, báo cáo, so sánh, định giá.

**Nội dung cần có:**

**Nguồn dữ liệu và cập nhật:**

| Nguồn | Loại dữ liệu | Giấy phép | Tần suất cập nhật |
| --- | --- | --- | --- |
| OpenStreetMap | Tiện ích, đường, POI | ODbL | Theo đợt (định kỳ) |
| WorldPop | Mật độ dân số | CC BY 4.0 | Theo năm |
| OpenAQ | Chất lượng không khí | CC BY 4.0 | Gần thời gian thực |
| FABDEM | Cao độ địa hình | Phi thương mại | Bản tĩnh |
| JRC | Rủi ro ngập theo sông | CC BY 4.0 | Bản tĩnh |
| GTFS Hà Nội | Điểm dừng xe buýt, metro | Công khai | Theo đợt |
| ESA WorldCover | Phủ bề mặt đất | CC BY 4.0 | Theo năm |

**Phương pháp tính:**
- Bán kính áp dụng của từng chỉ số (500 m đi bộ, 2 km xe đạp/ô tô)
- Cách đếm điểm gần nhất, cách xử lý dữ liệu trùng từ nhiều nguồn
- Khung giá là kết quả ước lượng dựa trên thuộc tính do người dùng tự khai, không phải giá giao dịch thực

**Giới hạn và tuyên bố miễn trách:**
- Kết quả phân tích là thông tin tham chiếu, **không phải kết luận pháp lý, định giá chính thức hay tư vấn đầu tư**
- Dữ liệu có thể lạc hậu hoặc không đầy đủ ở một số khu vực; khi thiếu thì ghi thiếu, không đưa ra kết luận
- Tọa độ geocoding có thể lệch vài chục đến vài trăm mét; báo cáo bám ghim người dùng đặt, không bám địa chỉ chữ
- Địa Thế không chịu trách nhiệm về quyết định giao dịch, đầu tư dựa trên kết quả phân tích

---

### 07 · Chính sách bản quyền và sở hữu trí tuệ

**Nội dung cần có:**

**Nội dung của Địa Thế:**
- Giao diện, thiết kế, mã nguồn, bài viết SEO thuộc quyền tác giả của cá nhân vận hành
- Không sao chép, phân phối lại khi chưa có phép

**Nội dung người dùng tải lên (ảnh tin đăng, ghi chú):**
- Người dùng giữ bản quyền; cấp cho Địa Thế quyền không độc quyền, không phí để lưu trữ, hiển thị và tạo thumbnail phục vụ dịch vụ
- Giấy phép này chấm dứt khi người dùng xóa nội dung hoặc tài khoản

**Nguồn dữ liệu bên thứ ba:**
- Ghi nguồn theo yêu cầu giấy phép: OSM contributors (ODbL), WorldPop, v.v.
- Không tái phân phối dữ liệu nguồn dưới hình thức thô nếu giấy phép không cho phép

**Báo cáo vi phạm bản quyền:**
- Email liên hệ để yêu cầu gỡ nội dung vi phạm
- Thông tin cần cung cấp: mô tả tác phẩm gốc, URL nội dung vi phạm, xác nhận quyền sở hữu
- Thời hạn xem xét: tối đa 5 ngày làm việc

---

## Nhóm B — Hồ sơ nội bộ và thủ tục hành chính

### 08 · Thông báo / đăng ký hoạt động thương mại điện tử

**Khi nào:** trước khi thu phí hoặc mở tính năng đăng tin công khai.

Căn cứ Luật TMĐT 122/2025/QH15 và Nghị định 248/2026/NĐ-CP:

| Tính năng | Mô hình | Thủ tục | Nơi thực hiện |
| --- | --- | --- | --- |
| Gói dịch vụ phân tích (cá nhân bán) | Website TMĐT bán hàng | Thông báo | online.gov.vn |
| Đăng tin BĐS (người khác đăng) | Nền tảng trung gian | Đăng ký | Bộ Công Thương |

Khi có cả hai thì phải **đăng ký** theo mô hình nền tảng. Đăng ký nền tảng trung gian thường yêu cầu pháp nhân hoặc cá nhân đăng ký kinh doanh hợp lệ. Cần xác nhận với Bộ Công Thương trước khi mở tính năng đăng tin.

---

### 09 · Nghĩa vụ thuế cá nhân kinh doanh online

**Khi nào:** trước khi có doanh thu.

- Đăng ký mã số thuế cá nhân kinh doanh tại cục thuế quận/huyện
- Kê khai và nộp thuế TNCN + VAT theo phương pháp khoán hoặc kê khai định kỳ
- SePay và các cổng thanh toán có thể báo cáo dòng tiền đến cơ quan thuế khi vượt ngưỡng
- Lưu giữ chứng từ giao dịch tối thiểu 5 năm
- Xuất hóa đơn điện tử khi người dùng yêu cầu (đăng ký hóa đơn điện tử theo Thông tư 78/2021/TT-BTC)

---

### 10 · Hồ sơ tuân thủ bảo vệ dữ liệu cá nhân

**Khi nào:** song song với khi triển khai dịch vụ.

Hồ sơ nội bộ, không nhất thiết công khai toàn bộ:
- Bản đánh giá tác động xử lý dữ liệu cá nhân (DPIA đơn giản): liệt kê loại dữ liệu, mục đích, rủi ro và biện pháp giảm thiểu
- Nhật ký ghi nhận đồng ý: thời điểm người dùng đồng ý, phiên bản chính sách, phương thức đồng ý
- Quy trình xử lý yêu cầu xem/sửa/xóa dữ liệu: thời hạn tối đa 72 giờ phản hồi theo luật
- Quy trình xử lý sự cố rò rỉ dữ liệu: thông báo người dùng và cơ quan BVDLCN (Bộ Công an) trong 72 giờ kể từ khi phát hiện

---

### 11 · Quy trình vận hành nội bộ

Hồ sơ chứng minh nền tảng hoạt động có kiểm soát, cần khi cơ quan quản lý yêu cầu giải trình:
- Quy trình kiểm duyệt tin đăng mới (thủ công hoặc tự động, tiêu chí duyệt/từ chối)
- Quy trình nhận và xử lý báo cáo vi phạm (từ người dùng tố cáo tin vi phạm)
- Quy trình xử lý khiếu nại (tài khoản bị khóa, tin bị gỡ oan)
- Nhật ký thao tác quản trị (xóa tin, khóa tài khoản, lý do, thời gian)
- Quy trình phối hợp với cơ quan nhà nước khi nhận yêu cầu cung cấp thông tin

---

### 12 · Hồ sơ nguồn dữ liệu và quyền khai thác

Danh mục nội bộ cần lập và duy trì:
- Từng nguồn dữ liệu: tên, URL gốc, giấy phép (ODbL, CC BY, CC0...), điều kiện ghi nguồn, giới hạn tái phân phối và thương mại hóa
- Ngày tải về và phiên bản dữ liệu
- Quyền cụ thể được phép: hiển thị, tổng hợp, phân tích, bán qua API hay không
- Nếu dùng API bên thứ ba (Goong, MapTiles...): lưu hợp đồng/điều khoản dịch vụ

---

## Nhóm C — Tài liệu bổ sung khi mở rộng

### 13 · Thỏa thuận sử dụng API

**Khi nào:** chỉ cần khi mở API cho bên thứ ba.

**Nội dung cần có:**
- Phạm vi dữ liệu được phép truy cập qua API
- Giới hạn truy vấn (rate limit), đơn vị tính và giá nếu có
- Cấm tái phân phối dữ liệu thô hoặc xây dựng sản phẩm cạnh tranh
- Yêu cầu ghi nguồn (attribution)
- Bảo mật khóa API, trách nhiệm khi để lộ
- Điều kiện thu hồi khóa, chấm dứt truy cập
- Cần xác nhận quyền cấp lại từng nguồn dữ liệu trước khi đưa vào API

---

## Tổng hợp

| # | Tài liệu | Nhóm | Bắt buộc khi | Ghi chú |
|---|---|---|---|---|
| 01 | Điều khoản sử dụng | A — Công khai | Mở đăng ký tài khoản | Cần trước OAuth Google |
| 02 | Chính sách quyền riêng tư | A — Công khai | Mở đăng ký tài khoản | Cần trước OAuth Google |
| 03 | Chính sách Cookie + banner | A — Công khai | Mở cho người dùng | Phải hoạt động kỹ thuật thực sự |
| 04 | Chính sách đăng tin | A — Công khai | Mở tính năng đăng tin | |
| 05 | Chính sách giá, thanh toán, hoàn tiền | A — Công khai | Trước khi thu phí / SePay | |
| 06 | Tuyên bố dữ liệu phân tích | A — Công khai | Mở tính năng phân tích | |
| 07 | Chính sách bản quyền | A — Công khai | Mở đăng tin có ảnh | |
| 08 | Thông báo / đăng ký TMĐT | B — Hành chính | Trước khi thu phí hoặc đăng tin | Xác nhận thủ tục với BCT |
| 09 | Nghĩa vụ thuế cá nhân | B — Hành chính | Trước khi có doanh thu | Cần MST để dùng SePay |
| 10 | Hồ sơ tuân thủ BVDLCN | B — Nội bộ | Song song triển khai | |
| 11 | Quy trình vận hành | B — Nội bộ | Song song mở tính năng | |
| 12 | Hồ sơ nguồn dữ liệu | B — Nội bộ | Trước khi dùng dữ liệu | |
| 13 | Thỏa thuận API | C — Mở rộng | Khi mở API bên thứ ba | |

**Không áp dụng:** sàn giao dịch / môi giới BĐS (cá nhân bị cấm vận hành theo Luật KDBĐS 2023 Điều 62).

---

## Căn cứ pháp lý

| Văn bản | Liên quan đến |
| --- | --- |
| Luật BVDLCN 91/2025/QH15 + NĐ 356/2025/NĐ-CP (hiệu lực 01/01/2026) | Mục 02, 03, 10 |
| Luật TMĐT 122/2025/QH15 + NĐ 248/2026/NĐ-CP (hiệu lực 01/07/2026) | Mục 04, 05, 08 |
| Luật Kinh doanh BĐS 29/2023/QH15 + NĐ 96/2024/NĐ-CP (hiệu lực 01/01/2025) | Ranh giới đăng tin vs sàn giao dịch |
| Luật BVQLNTD 19/2023/QH15 | Mục 01, 05 |
| Luật Quảng cáo sửa đổi 75/2025/QH15 (hiệu lực 01/01/2026) | Khi có nội dung tài trợ |
| Thông tư 78/2021/TT-BTC | Mục 09 — hóa đơn điện tử |
| Google API Services User Data Policy | Mục 02 — OAuth Google |
| Điều khoản SePay | Mục 05, 09 — điều kiện merchant |

---

*Tài liệu này là định hướng tuân thủ, không thay thế tư vấn pháp lý. Với tính năng đăng tin BĐS và thu phí, nên nhờ luật sư Việt Nam rà soát mô hình hoạt động trước khi mở public hoặc thu phí.*
