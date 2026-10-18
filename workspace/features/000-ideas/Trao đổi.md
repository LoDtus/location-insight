Tôi đang muốn làm dự án website, pwa, cho phép người dùng nhập địa chỉ của họ vào thì sẽ đánh giá điểm mạnh, điểm yếu về bất động sản của nơi đó. Với phạm vi ban đầu là trong hà nội, và kinh phí cho các dịch vụ trả phí bên ngoài dưới 1 triệu đồng nếu phải trả tiền. Vậy thì với kinh phí thấp nhất có thể, đồng thời tại hà nội hiện nay thì lại đang quy hoạch rất nhanh, việt nam cũng bị cấm dùng google map api, tuy nhiên, nếu có bên nào cũng cấp dịch vụ api google map tại việt nam thì cũng được, tuy nhiên phải cân đối và đảm bảo giá tiền thấp nhất có thể. Thì với bài toán của tôi, các dịch vụ, data tôi cần có bao gồm những gì trong giai đoạn đầu này trong việc phân tích  bất động sản

vậy thì đâu là model đủ tốt và tối ưu cho bài toán này?

Searched the web
Gợi ý: bắt đầu với model hạng “Flash-Lite” của Gemini cho bản đầu, và so sánh với một model thứ hai trước khi chốt. Tôi chưa thể đo chất lượng tiếng Việt của từng model trên dữ liệu của bạn, nên phần “chốt” nên dựa trên một bài thử nhỏ (bên dưới).

Vì sao nhóm model rẻ là đủ
Việc của LLM ở đây chỉ là đọc một JSON đã tính sẵn rồi viết khoảng 150-300 chữ nhận xét tiếng Việt. Không cần suy luận sâu, không cần ngữ cảnh dài. Model lớn và đắt không cho kết quả tốt hơn rõ rệt ở loại việc này.

Các lựa chọn
Giá dưới đây lấy từ các bài tổng hợp bên thứ ba, không phải trang giá chính thức, và model đổi tên/giá rất nhanh. Hãy xác nhận trên trang giá của nhà cung cấp trước khi chốt.

Ưu tiên	Model	Giá tham khảo (USD / 1 triệu token, vào/ra)	Ghi chú
1	Gemini Flash-Lite (bản mới nhất)	Một bài tổng hợp ghi Flash-Lite khoảng $0,30/$2,50	Rẻ nhất, có free tier để thử
2	Gemini Flash (bản mới nhất)	Một bài tổng hợp ghi Flash 3.6 ở $1,50/$7,50 (tháng 7/2026)	Viết tự nhiên hơn, đắt hơn khoảng 5 lần
3	Claude Haiku 5.5 (claude-haiku-5-5)	Tôi chưa kiểm chứng giá	Đáng thử về độ bám JSON và văn phong
Không nên	Ollama / model tự host	Tốn GPU, công vận hành	Chỉ dùng thử prompt ở máy cá nhân
Chi phí thực tế
Giả sử mỗi lượt phân tích dùng khoảng 1.500 token đầu vào (JSON) và 500 token đầu ra.

Với mức giá Flash-Lite ở trên: khoảng 0,0017 USD, tức vài chục đồng mỗi lượt. 1.000 lượt khoảng 45.000 đồng.
Với mức giá Flash ở trên: khoảng 0,006 USD, tức ~150 đồng mỗi lượt.
Cộng thêm cache theo geohash thì chi phí còn thấp hơn, nên ngân sách dưới 1 triệu là dư cho phần LLM.

Hai lưu ý quan trọng
Free tier có thể dùng dữ liệu của bạn để cải thiện sản phẩm. Bài tổng hợp tôi tìm thấy ghi rõ điều này cho free tier của AI Studio. Vì người dùng nhập địa chỉ, hãy chỉ dùng free tier lúc phát triển với dữ liệu mẫu, và chuyển sang bản trả phí khi có người dùng thật. Hãy đọc điều khoản dữ liệu của gói bạn chọn.
Đừng khoá cứng vào một model. Model cũ bị ngừng khá nhanh (ví dụ một trang ghi Gemini 1.5 Flash đã ngừng và gọi bằng tên cũ sẽ báo lỗi). Để tên model trong biến cấu hình, và viết một lớp gọi LLM duy nhất.
Cách chốt model (làm được bằng vibe code)
Chuẩn bị 20 địa chỉ đa dạng ở Hà Nội (nội thành, ngoại thành, khu mới, khu ngập) cùng JSON điểm số của chúng.
Chạy cùng một prompt trên 3 model: Flash-Lite, Flash, Haiku 5.5.
Chấm theo bốn tiêu chí: (a) không bịa số liệu ngoài JSON, (b) trả đúng schema JSON, (c) văn phong tiếng Việt tự nhiên, (d) nói rõ khi thiếu dữ liệu.
Chọn model rẻ nhất đạt cả bốn tiêu chí. Tiêu chí (a) là quan trọng nhất với sản phẩm bất động sản.
Nếu muốn, tôi viết giúp prompt hệ thống và schema JSON đầu ra cho lớp nhận xét, kèm script chạy so sánh 3 model để bạn giao cho agent code.

vậy thì mức giá trung bình cho dự án này mỗi tháng tôi cần bỏ ra là bao nhiêu?

Estimating monthly hosting costs in local currency.
Estimating monthly hosting costs in local currency.
Ước tính: khoảng 50.000-150.000 đồng/tháng khi phát triển và chạy thử, và khoảng 300.000-700.000 đồng/tháng khi có vài nghìn lượt phân tích. Ngân sách dưới 1 triệu/tháng là đủ cho giai đoạn đầu.

Các con số dưới đây là ước tính của tôi. Giá của Goong, hosting và cơ sở dữ liệu tôi chưa kiểm chứng, nên hãy xem lại trang giá của từng bên trước khi chốt. Tỷ giá tôi tạm tính khoảng 26.000 đồng/USD.

Theo từng giai đoạn
Hạng mục	Phát triển / thử nghiệm	Mở cho người dùng (vài nghìn lượt/tháng)
Tên miền	~25.000 đ/tháng (~300k/năm)	~25.000 đ
Hosting web/PWA (Cloudflare Pages/Workers)	0 đ	0 đ
Cơ sở dữ liệu PostGIS (Neon/Supabase free hoặc VPS)	0 đ	0 đ nếu vừa gói free, hoặc VPS ~100.000-200.000 đ
Bản đồ (MapLibre + tile)	0 đ	0 đ
Geocoding (Goong)	0 đ trong hạn mức free	0 đ, hoặc theo gói nếu vượt hạn mức (xem trang giá Goong)
Dữ liệu (OSM, WorldPop, OpenAQ, DEM)	0 đ	0 đ
LLM viết nhận xét	0-20.000 đ (free tier hoặc rất ít lượt)	~50.000-450.000 đ tuỳ số lượt và model
Tổng	~50.000-150.000 đ	~300.000-700.000 đ
Phần LLM tính thế nào
Theo mức giá tôi tìm được ở trên, mỗi lượt phân tích tốn khoảng 45 đồng với Flash-Lite và khoảng 150 đồng với Flash.

1.000 lượt: khoảng 45.000 đ (Flash-Lite) hoặc 150.000 đ (Flash).
10.000 lượt: khoảng 450.000 đ (Flash-Lite) hoặc 1,5 triệu (Flash), chưa tính cache.
Cache theo geohash giúp giảm đáng kể, vì nhiều người sẽ tra cứu cùng một khu vực.

Những khoản dễ bị bỏ sót
Dung lượng cơ sở dữ liệu. Gói free của Neon/Supabase có giới hạn dung lượng nhỏ (cỡ vài trăm MB, cần kiểm tra). Dữ liệu OSM cả Việt Nam sẽ không vừa, nên chỉ nhập phần Hà Nội. Nếu vẫn không đủ, một VPS ~100.000-200.000 đ/tháng là lựa chọn rẻ nhất.
Gói free của DB có thể tạm dừng khi không dùng. Điều này chấp nhận được lúc thử nghiệm nhưng gây chậm với người dùng thật.
Công cụ vibe code. Nếu dùng gói trả phí của agent code (Claude Code, Cursor...), đây có thể là khoản lớn nhất, thường lớn hơn toàn bộ hạ tầng. Tôi không tính khoản này ở bảng trên.
Dữ liệu giá thị trường thương mại không nằm trong bảng, vì nó có thể vượt cả ngân sách (đã nói ở bảng nguồn dữ liệu).
Cách giữ chi phí thấp nhất
Giai đoạn dev dùng toàn bộ free tier, với địa chỉ mẫu (không dùng dữ liệu người dùng thật).
Chỉ nhập dữ liệu Hà Nội, không nhập cả nước.
Cache kết quả theo geohash và đặt giới hạn số lượt phân tích mỗi người dùng mỗi ngày để tránh bị lạm dụng.
Đặt hạn mức chi tiêu hoặc cảnh báo ngân sách ở nhà cung cấp LLM, để một lỗi lặp vô hạn không làm hoá đơn tăng bất ngờ.
Nếu bạn cho tôi biết dự kiến số người dùng và số lượt phân tích/tháng, tôi sẽ tính lại bảng này sát hơn.


