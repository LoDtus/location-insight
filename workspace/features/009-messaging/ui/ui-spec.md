# Đặc tả giao diện — Nhắn tin (`/app/messages`)

Theo `.cursor/skills/00-ux-ui/ui-design` ở chế độ **Preserve**: giữ nhận diện sẵn có của sản phẩm (màu, chữ, bán kính, bộ icon trong `website/src/app/globals.css` và `workspace/features/001-ui`), chỉ quyết định bố cục, thứ bậc, trạng thái và hành vi. Tham khảo bố cục của Threads và Messenger (ảnh người dùng cung cấp) nhưng **không** sao chép màu thương hiệu hay logo của họ. Bong bóng dùng token của dự án (`--ink` cho tin của mình, nền nhạt cho tin người kia), không dùng màu đen cố định như ảnh mẫu.

## 1. Mục tiêu từng màn

| Màn | Mục tiêu một câu |
| --- | --- |
| Danh sách hội thoại | Thấy ngay ai nhắn gì, cái nào chưa đọc, rồi mở đúng hội thoại |
| Khung hội thoại | Đọc và trả lời nhanh, không phải cuộn tìm, không mất tin |
| Yêu cầu nhắn (Requests) | Quyết định chấp nhận, từ chối hay chặn một người lạ mà không bị ép trả lời |
| Soạn tin mới | Tìm đúng một người và bắt đầu |
| Cài đặt nhắn tin | Kiểm soát ai nhắn mình và những gì người khác thấy |
| Admin: báo cáo | Xử lý một báo cáo với đủ ngữ cảnh, không đọc hội thoại khác |

## 2. Bố cục

### Máy tính (≥ 1024 px): ba vùng

```
┌───────────┬───────────────────────┬──────────────────────────────────────────┐
│ Menu app  │ Messages        [✎]   │ ◉ Tên người kia            · Hoạt động.. [⋯]│
│ (sẵn có)  │ [🔍 Tìm kiếm       ]  │──────────────────────────────────────────│
│ …         │ (Inbox) (Requests ②)  │                                          │
│ ▸Messages │ ──────────────────── │        ┌ tin của người kia ┐             │
│     ③     │ ◉ Hùng       2 ngày  │  ◉ ┌───┐                     tin của mình ▶│
│           │   damn…              │    └───┘            ┌────────────────────┐│
│           │ ◉ Linh●      3 ngày  │   Đã xem            │ Bạn đã trả lời …    ││
│           │   Bạn đã gửi 1 bài   │                     └────────────────────┘│
│           │ ◉ Quý        1 tuần  │──────────────────────────────────────────│
│           │                       │ [＋] [☺] Nhắn tin…                  [Gửi] │
└───────────┴───────────────────────┴──────────────────────────────────────────┘
```

- Menu app: dùng layout `/app` sẵn có. Mục "Messages" có icon và badge số chưa đọc của Inbox (chặn "99+").
- Cột danh sách: rộng 320–360 px, cố định, cuộn riêng.
- Khung hội thoại: chiếm phần còn lại, tối đa 960 px nội dung; bong bóng tối đa 70% bề rộng khung.
- Thanh soạn tin dính đáy khung hội thoại; không đè lên nội dung cuối.

### Máy tính bảng (768–1023 px)

Menu app thu gọn thành icon. Cột danh sách 300 px. Khung hội thoại phần còn lại.

### Điện thoại (< 768 px): một cột, điều hướng theo tầng

- `/app/messages`: chỉ danh sách. Chạm vào hội thoại mở `/app/messages/{conversationId}` toàn màn hình, có nút ← quay lại danh sách.
- Badge nằm ở thanh điều hướng dưới (nếu website dùng thanh dưới) hoặc ở menu.
- Bàn phím ảo: thanh soạn tin dính phía trên bàn phím, dùng `visualViewport` để không bị che. Chạm tin để hiện hành động (không có hover).

## 3. Danh sách hội thoại

- Tiêu đề "Messages" (hoặc "Tin nhắn" theo ngôn ngữ giao diện của app) và nút soạn tin mới (icon bút, `aria-label="Tin nhắn mới"`).
- Ô tìm kiếm: lọc theo tên người kia; debounce 250 ms; ≥ 2 ký tự mới gọi server; ít hơn thì lọc cục bộ trên các hội thoại đã tải. Bấm Esc xóa.
- Hai nút dạng viên thuốc: **Inbox** và **Requests**. Requests có chấm hoặc số khi có yêu cầu chưa xem. Đổi tab không tải lại cả trang.
- Dòng hội thoại (cao tối thiểu 72 px, vùng chạm ≥ 44 px):
  - Ảnh đại diện tròn 48 px (chữ cái đầu khi không có ảnh; không dùng ô xám trơn).
  - Tên in đậm; chưa đọc thì cả tên và dòng xem trước in đậm kèm chấm báo.
  - Dòng xem trước: một dòng, cắt bằng dấu chấm lửng. Mẫu: "Bạn: …" cho tin của mình; "Đã gửi ảnh"; "Đã gửi một bài viết"; "Tin nhắn đã thu hồi".
  - Thời gian tương đối bên phải: "Vừa xong", "5 phút", "2 giờ", "Hôm qua", "2 ngày", "1 tuần", sau đó ngày tháng.
  - Hội thoại tắt thông báo: icon chuông gạch chéo nhỏ.
  - Hội thoại đang mở: nền nhấn nhẹ, `aria-current="page"`.
- Menu ngữ cảnh của dòng (chuột phải, giữ lâu trên di động, hoặc nút ⋯ khi hover): Tắt thông báo, Xóa hội thoại, Chặn.
- Cuộn vô hạn theo con trỏ trang (30 mỗi lần). Có chỉ báo "đang tải thêm".
- Khi có tin mới ở hội thoại ngoài trang đầu: đẩy hội thoại lên đầu danh sách (cập nhật cục bộ từ sự kiện, không tải lại).

### Trạng thái danh sách

| Trạng thái | Nội dung |
| --- | --- |
| Đang tải | 6 dòng khung xương (avatar tròn + hai thanh chữ), không spinner toàn trang |
| Trống (Inbox) | Minh họa/biểu tượng nhỏ, "Chưa có tin nhắn nào", nút "Bắt đầu một cuộc trò chuyện" |
| Trống (Requests) | "Không có yêu cầu nào. Người lạ nhắn bạn lần đầu sẽ xuất hiện ở đây." |
| Lỗi tải | "Không tải được tin nhắn." + nút "Thử lại"; giữ dữ liệu cũ nếu có |
| Không có kết quả tìm | "Không thấy ai tên “…”" |
| Mất kết nối realtime | Banner mảnh trên cùng khung: "Đang kết nối lại…" (không chặn thao tác) |

## 4. Khung hội thoại

### Đầu khung

- Ảnh đại diện + tên (liên kết tới hồ sơ công khai) + dòng trạng thái: "Đang hoạt động" (chấm xanh), "Hoạt động 9 giờ trước", hoặc để trống khi một trong hai bên tắt. Trạng thái lấy lại khi mở hội thoại và mỗi 60 giây khi tab hiển thị.
- Nút ⋯: Xem hồ sơ, Tắt thông báo, Chặn, Báo cáo, Xóa hội thoại. Mọi hành động phá hủy có hộp xác nhận nêu rõ hậu quả ("Chỉ xóa phía bạn, người kia vẫn còn" / "Người này sẽ không nhắn được cho bạn").
- Điện thoại: nút ← ở trái.

### Danh sách tin

- Sắp theo `seq` tăng dần, cuộn từ dưới lên. Tin của mình căn phải, của người kia căn trái kèm avatar 28 px ở tin cuối của mỗi cụm.
- **Cụm tin**: các tin liên tiếp cùng người gửi trong < 3 phút gộp: khoảng cách 2 px, góc bo của bong bóng ở phía tiếp giáp giảm; giữa hai cụm 12 px.
- **Dải thời gian**: chèn "Hôm nay 14:05" / "Hôm qua 09:12" / "12 thg 10, 2026" khi cách tin trước > 30 phút hoặc khác ngày. Giờ hiển thị theo múi giờ trình duyệt; `title` hiện thời điểm đầy đủ khi hover.
- **Bong bóng**: chữ 15–16 px, `line-height ≥ 1.4`, ngắt từ dài (`overflow-wrap: anywhere`), giữ xuống dòng (`white-space: pre-wrap`), tối đa ~70% khung. Tin của mình dùng nền nhấn mạnh với chữ tương phản ≥ 4.5:1; tin người kia nền nhạt.
- **Trích dẫn trả lời**: nhãn "Bạn đã trả lời" / "Linh đã trả lời" phía trên một bong bóng nhỏ mờ chứa trích đoạn (tối đa 120 ký tự), rồi tới bong bóng chính. Bấm vào trích dẫn cuộn tới tin gốc (tải thêm nếu chưa có) và nhấp nháy nền 1 giây (tắt khi `prefers-reduced-motion`).
- **Ảnh**: lưới 1–4 ảnh, bo góc theo `--radius`, giữ tỉ lệ bằng `width/height` từ API (không nhảy bố cục khi tải), `loading="lazy"`, `alt` mô tả chung ("Ảnh do Linh gửi"). Bấm mở khung xem lớn (lightbox) có nút đóng, phím ←/→ chuyển ảnh, Esc đóng, giữ focus trong khung.
- **Bài chia sẻ**: thẻ nhỏ gồm tên tác giả, trích 200 ký tự, nút "Mở bài" (tới `/app/feed/{id}`). Bài không còn: thẻ xám "Bài viết không còn".
- **Cảm xúc**: một dải chip dưới bong bóng gom theo emoji kèm số, chip của mình có viền nhấn; bấm để bỏ/đổi.
- **Thu hồi**: bong bóng viền nét đứt, chữ nghiêng "Tin nhắn đã thu hồi" (người gửi: "Bạn đã thu hồi một tin nhắn"). Không để lộ nội dung cũ.
- **Trạng thái gửi** của tin mình: đang gửi (mờ 60% + icon đồng hồ nhỏ), đã gửi (không biểu tượng), lỗi (viền đỏ, icon cảnh báo, nút "Gửi lại" và "Xóa"). "Đã xem" chỉ hiện dưới **tin cuối cùng của mình đã được đọc**, khi người kia bật báo đã đọc.
- **Hành động khi di chuột** (máy tính) hoặc chạm giữ (di động), nằm cạnh bong bóng: thả cảm xúc (☺), trả lời (↩), ⋯ (Sao chép, Thu hồi nếu là của mình, Báo cáo nếu là của người kia). Tất cả có `aria-label`, mở được bằng bàn phím (Tab tới tin → Enter mở menu).
- Cuộn:
  - Mở hội thoại: cuộn xuống tin cuối; nếu có tin chưa đọc, cuộn tới ranh giới **"Tin mới"** (đường kẻ + nhãn) đầu tiên chưa đọc.
  - Có tin mới khi người dùng đang ở cách đáy < 120 px: tự cuộn xuống. Xa hơn: không cuộn, hiện nút nổi "Tin mới ↓" kèm số.
  - Cuộn lên gần đỉnh (< 200 px): tải trang cũ (`before_seq`), giữ vị trí cuộn bằng neo (scroll anchoring), hiện chỉ báo ở đỉnh.
  - Khi số bong bóng trong DOM > 300: ảo hóa danh sách (windowing) hoặc cắt bớt phía xa; thư viện mới phải qua quy tắc dependency của dự án.
- Vùng danh sách tin có `role="log"`, `aria-live="polite"`, `aria-relevant="additions"`; không đọc lại toàn bộ khi tải trang cũ.
- Dấu hiệu đang gõ: ba chấm động ở đáy danh sách, `aria-live` im lặng (không đọc to), ẩn sau 5 giây không có tín hiệu mới.

### Thanh soạn tin

- Nút **＋** (đính kèm ảnh: chọn tệp, kéo-thả, dán từ clipboard), nút **☺** (bảng emoji để chèn vào văn bản), ô nhập nhiều dòng tự co giãn 1–6 dòng, nút Gửi.
- Nút Gửi chỉ hiện (hoặc chỉ bật) khi có chữ hoặc ảnh; trạng thái vô hiệu có `aria-disabled`.
- Phím: **Enter** gửi; **Shift+Enter** xuống dòng; trên điện thoại Enter xuống dòng, gửi bằng nút. Khi đang gõ tiếng Việt có bộ gõ (IME) đang ghép từ (`isComposing`), Enter không gửi.
- Đếm ký tự: hiện khi còn dưới 200 ký tự tới giới hạn 2.000 ("1.870/2.000"). Quá thì nút Gửi tắt, không cắt cụt chữ của người dùng.
- Ảnh đính kèm hiện hàng thu nhỏ phía trên ô nhập với nút bỏ; tối đa 4; tiến trình tải có thanh nhỏ; ảnh lỗi hiện nhãn "Không tải được" và nút bỏ.
- Đang trả lời một tin: chip "Đang trả lời Linh: …" phía trên ô nhập, có nút ✕.
- Nháp: lưu theo hội thoại trong `sessionStorage` (có try/catch), khôi phục khi quay lại; xóa sau khi gửi.
- Gửi `typing` (active=true) tối đa mỗi 2 giây khi đang gõ; `active=false` sau 3 giây dừng hoặc khi gửi.
- Khi không được gửi: thay cả thanh soạn bằng thông báo (xem mục 5).

## 5. Các trạng thái đặc biệt của hội thoại

| Tình huống | Hiển thị |
| --- | --- |
| Yêu cầu nhắn (mình là người nhận) | Thay thanh soạn bằng khối: tên người, "Muốn nhắn tin cho bạn", ba nút: **Chấp nhận**, **Từ chối**, **Chặn**; liên kết "Báo cáo". Tin hiển thị ở trên, chưa có "Đã xem" cho người kia cho tới khi chấp nhận |
| Yêu cầu nhắn (mình là người gửi, đã gửi 1 tin) | Thanh soạn bị vô hiệu, ghi: "Bạn có thể nhắn thêm sau khi người này chấp nhận." Không có biểu hiện bị từ chối |
| Mình đã chặn người kia | Thanh soạn thay bằng: "Bạn đã chặn người này." + nút "Bỏ chặn" |
| Mình bị chặn hoặc người kia ngừng nhận | Thanh soạn bị vô hiệu: "Bạn không thể nhắn tin cho người này." (không nói lý do) |
| Tài khoản người kia đã xóa/khóa | Tên "Người dùng đã xóa", avatar mặc định, thanh soạn bị vô hiệu, chữ giải thích |
| Hội thoại không tồn tại hoặc không phải của mình | Trang 404 chung (không nói "không có quyền") |
| Mất mạng khi mở | Giữ tin đã tải; banner "Không có kết nối"; cho soạn nháp; gửi lỗi sẽ vào trạng thái "Gửi lại" |
| Quá giới hạn tốc độ (429) | Toast "Bạn gửi hơi nhanh, thử lại sau X giây" (dùng `Retry-After`); thanh soạn vẫn mở, tin giữ ở trạng thái lỗi |
| Phiên hết hạn / bị thu hồi | Dùng luồng sẵn có của 003-auth (chuyển tới đăng nhập, không mất nháp) |

## 6. Soạn tin mới

- Mở bằng nút ✎ hoặc nút "Nhắn tin" ở hồ sơ (bỏ qua bước tìm, mở thẳng hội thoại).
- Hộp thoại (dialog, `role="dialog"`, giữ focus, Esc đóng): ô "Tới:" có tìm kiếm; kết quả tối đa 10 dòng (avatar + tên); chọn một người; nút "Trò chuyện" mở khung hội thoại **nháp** ở phía client (chưa có bản ghi ở DB). Chỉ khi người dùng bấm gửi tin đầu tiên, client mới gọi `POST /messaging/conversations` rồi `POST .../messages`. Nếu đã có hội thoại với người này, API trả hội thoại cũ (200) và khung mở hội thoại thật. Hội thoại không có tin nào quá 24 giờ (do lỗi giữa hai lời gọi) bị job dọn xóa.
- Người chưa nhận tin vì đặt `nobody`: không xuất hiện trong kết quả.

## 7. Điểm vào từ phần khác của ứng dụng

- Hồ sơ công khai: nút **Nhắn tin**.
- Bài ở `/app/feed`: menu bài có "Gửi qua tin nhắn"; mở hộp chọn người (người đã có hội thoại lên đầu) + ô ghi chú tùy chọn; gửi `kind = post_share`.
- Menu app: mục Messages có badge. Số badge cập nhật qua sự kiện `unread.changed` và `message.created`.
- Tiêu đề tab trình duyệt: "(2) Tin nhắn" khi có chưa đọc và tab không hiển thị.

## 8. Cài đặt nhắn tin (trong `/app/profile` hoặc `/app/messages/settings`)

- "Ai có thể nhắn cho bạn": Mọi người / Không ai.
- "Hiện trạng thái hoạt động" (công tắc). Ghi chú: tắt thì bạn cũng không thấy của người khác.
- "Gửi báo đã xem" (công tắc). Ghi chú tương tự.
- Danh sách người đã chặn với nút Bỏ chặn.
- Dòng thông báo: "Tin nhắn không được mã hóa đầu cuối. Tin bạn báo cáo có thể được người vận hành xem."

## 9. Màn admin `/admin/messaging`

- Bảng báo cáo: lý do, người báo, người bị báo, thời gian, trạng thái. Lọc theo trạng thái. Phân trang theo con trỏ.
- Chi tiết: hiển thị **chỉ** `context_snapshot` (tin bị báo cáo được nhấn mạnh, tối đa 10 tin quanh nó). Không có nút "mở hội thoại".
- Hành động: Bỏ qua, Ẩn tin; bắt buộc nhập lý do (≥ 5 ký tự). Liên kết sang trang người dùng (004-rbac) để khóa tài khoản nếu cần.
- Kiểu dáng theo `/admin` sẵn có (bảng, mật độ, màu).

## 10. Chạm, chữ, màu, chuyển động, truy cập

- Mọi vùng chạm ≥ 44 × 44 px; focus nhìn rõ (`var(--focus)`); tương phản chữ ≥ 4.5:1.
- Không dùng màu làm tín hiệu duy nhất: chưa đọc = chữ đậm + chấm; lỗi gửi = icon + chữ.
- Chuyển động ≤ 200 ms (tin mới trượt nhẹ), tắt khi `prefers-reduced-motion`.
- Mọi biểu tượng thuần icon có `aria-label` tiếng Việt; ảnh đại diện có `alt=""` khi đã có tên bên cạnh.
- Văn bản của người dùng luôn render bằng text node (không HTML).
- Kiểm tra bố cục ở 1440, 1024, 768, 390 px; bàn phím ảo trên iOS và Android.

## 11. Cách tổ chức mã giao diện (gợi ý)

- Thư mục: `website/src/features/messaging/` theo mẫu `features/discussions`: `messaging.api.ts`, `components/` (ConversationList, ConversationRow, Thread, MessageBubble, Composer, RequestBar, NewMessageDialog), `hooks/` (`useMessagingSocket`, `useConversation`).
- Trạng thái: Redux Toolkit store đang dùng. Chuẩn hóa theo `conversationId` → `{ messages: Record<seq, Message>, order: seq[], lastSeq, ... }`; hợp nhất mọi nguồn (REST, socket, gửi lạc quan) qua một reducer duy nhất khóa theo `seq` hoặc `clientMsgId`, để không trùng.
- Socket client dùng chung một singleton với tính năng thông báo; nối bằng vé từ `POST /realtime/ticket`; lùi theo cấp số nhân khi lỗi.
- Không đưa nội dung tin vào `redux-persist` (dữ liệu riêng tư không nên nằm ở localStorage); chỉ lưu nháp ở `sessionStorage`.
- Xóa toàn bộ trạng thái nhắn tin khi đăng xuất (có sẵn `store/reset.ts`).
