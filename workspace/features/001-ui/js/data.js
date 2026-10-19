(function () {
  const UPDATED = "18/10/2026";

  function m(label, result, source, confidence, radius) {
    return { label, result, source, confidence, radius, updated: UPDATED };
  }

  const places = [
    {
      id: "van-mieu",
      title: "Ngõ Văn Miếu",
      address: "18 ngõ Văn Miếu, phường Văn Miếu - Quốc Tử Giám, Hà Nội",
      lat: 21.0274,
      lng: 105.8352,
      image: "images/ngo-ha-noi.webp",
      imageAlt: "Ngõ nhỏ ở Hà Nội với cửa hàng hai bên, ảnh khu vực minh họa.",
      coverage: "47 chỗ",
      coverageHint: "Mức phủ khá cho một ngõ nội thành",
      priceContext: "noi-thanh",
      queries: ["van mieu", "ngo van mieu", "18 ngo van mieu", "quoc tu giam"],
      geocodeNote: "Geocode mẫu khớp tên ngõ. Điểm có thể lệch vài chục đến vài trăm mét. Kéo ghim vào đúng ô đất.",
      summary:
        "Ghim nằm trong phường Văn Miếu - Quốc Tử Giám. Trong vòng 500 m, lớp bản đồ mở thấy 47 chỗ: 6 hiệu thuốc, gần nhất khoảng 90 m; 1 chợ khoảng 280 m; 1 siêu thị khoảng 420 m. Điểm xe buýt gần nhất khoảng 110 m. Đường lớn loại secondary cách khoảng 70 m, nhưng ngay tại ghim không có bề rộng ngõ và không có tag vỉa hè, nên không kết luận xe vào được. Không thấy cửa hàng vật tư trong 500 m; mục này phủ yếu, không có nghĩa là khu trống. Cao độ khoảng 9,4 m, thấp hơn trung vị xung quanh 0,6 m. Ô này không nằm trong vệt ngập sông mô hình chu kỳ 10 năm và 100 năm. Đó không phải bản đồ ngập đường của Hà Nội. Chưa có dữ liệu quy hoạch theo thửa.",
      strengths: [
        "Hiệu thuốc gần: 6 điểm trong 500 m, gần nhất khoảng 90 m.",
        "Điểm xe buýt khoảng 110 m, trong bán kính đi bộ.",
        "Có chợ và siêu thị trong 500 m, tách riêng cửa hàng tiện lợi.",
      ],
      gaps: [
        "Không rõ vỉa hè và bề rộng ngay tại ghim.",
        "Không thấy cửa hàng vật tư. Phủ dữ liệu yếu, không kết luận khu không có.",
        "Ga metro gần nhất ngoài bán kính 2 km.",
        "Chưa đủ chuỗi ngập khi mưa.",
        "Chưa có dữ liệu quy hoạch theo thửa.",
      ],
      kpis: [
        { label: "Mức phủ trong 500 m", value: "47 chỗ", hint: "OpenStreetMap, số mẫu" },
        { label: "Hiệu thuốc gần nhất", value: "90 m", hint: "Trong bán kính đi bộ" },
        { label: "Tới Hồ Gươm", value: "1,8 km", hint: "Mốc nội đô cố định" },
      ],
      groups: [
        {
          title: "Tiện ích đi bộ, 500 m",
          intro: "Khoảng cách tới điểm gần nhất và số điểm trong bán kính. Nguồn chính là OpenStreetMap.",
          metrics: [
            m("Chợ", "1 chợ trong 500 m. Gần nhất khoảng 280 m.", "OpenStreetMap, amenity=marketplace.", "trung-binh", "500 m"),
            m("Hiệu thuốc", "6 hiệu thuốc. Gần nhất khoảng 90 m.", "OpenStreetMap, amenity=pharmacy.", "cao", "500 m"),
            m("Siêu thị", "1 siêu thị, khoảng 420 m. Không gộp cửa hàng tiện lợi.", "OpenStreetMap, shop=supermarket.", "trung-binh", "500 m"),
            m("Cửa hàng tiện lợi", "4 điểm. Gần nhất khoảng 150 m.", "OpenStreetMap, shop=convenience.", "trung-binh", "500 m"),
            m("UBND", "Trụ sở phường gần nhất khoảng 610 m, ngoài 500 m.", "OpenStreetMap, amenity=townhall.", "thap", "500 m"),
            m("Cửa hàng vật tư", "0 điểm trong 500 m. Phủ yếu. Không kết luận là khu không có cửa hàng.", "OpenStreetMap, shop=hardware.", "thap", "500 m"),
            m("Quán ăn, cà phê", "22 điểm trong 500 m. Không tách được quán ăn sáng.", "OpenStreetMap, restaurant, cafe, fast_food.", "trung-binh", "500 m"),
            m("Công viên", "Công viên có tên gần nhất khoảng 350 m.", "OpenStreetMap, leisure=park.", "trung-binh", "500 m"),
            m("Trường học", "Trường gần nhất khoảng 180 m. Không có nhãn trường tốt.", "OpenStreetMap, amenity=school.", "trung-binh", "500 m"),
            m("Bệnh viện", "2 bệnh viện trong 2 km. Gần nhất khoảng 1,1 km.", "OpenStreetMap, amenity=hospital.", "trung-binh", "2 km"),
          ],
        },
        {
          title: "Đi lại và đường",
          intro: "Một ghim không biết mặt nào là mặt tiền. Cấp đường không phải kết luận xe cứu hỏa.",
          metrics: [
            m("Đường lớn", "Đường secondary gần nhất khoảng 70 m.", "OpenStreetMap, highway=secondary.", "cao", "tới đường gần nhất"),
            m("Cấp đường gần ghim", "Đường residential. Không có tag width hay lanes. Không rõ bề rộng.", "OpenStreetMap, highway, width, lanes.", "thap", "đoạn gần ghim"),
            m("Vỉa hè", "Không có tag sidewalk tại ghim. Không rõ có vỉa hè hay không.", "OpenStreetMap, sidewalk.", "thieu", "đoạn gần ghim"),
            m("Tới nội đô", "Khoảng 1,8 km tới Hồ Gươm.", "Mốc cố định 21,0285° B, 105,8520° Đ.", "cao", "một điểm"),
            m("Ga metro", "Ga Cát Linh khoảng 2,5 km, ngoài bán kính 2 km. Chỉ tính ga đang chạy.", "Sơ đồ ga đang khai thác và OpenStreetMap.", "trung-binh", "2 km"),
            m("Điểm xe buýt", "Điểm dừng gần nhất khoảng 110 m.", "GTFS Hà Nội và OpenStreetMap.", "cao", "500 m"),
            m("Khoảng cách tới nguồn ồn", "Khoảng 1,6 km tới motorway hoặc trunk. Khoảng 24 km tới Nội Bài. Đây là khoảng cách, không phải đo tiếng ồn.", "OpenStreetMap.", "trung-binh", "tới điểm gần nhất"),
          ],
        },
        {
          title: "Dân số, không khí, địa hình",
          intro: "Các lớp này để so tương đối. Không viết thành câu chắc như hồ sơ từng ngõ.",
          metrics: [
            m("Dân số ước tính", "Khoảng 9.400 người trong vòng 500 m. Không phải mật độ từng ngõ.", "WorldPop 100 m, R2025A.", "trung-binh", "500 m"),
            m("Không khí", "Trạm gần nhất cách khoảng 2,1 km. PM2.5 khoảng 28 µg/m³ lúc 14:00 ngày 18/10/2026.", "OpenAQ.", "trung-binh", "3 km"),
            m("Cao độ", "Khoảng 9,4 m, thấp hơn trung vị 500 m khoảng 0,6 m. Không ghi dễ ngập từ riêng số này.", "FABDEM, bản 2021.", "trung-binh", "ô 30 m và 500 m"),
            m("Ngập sông mô hình", "Không nằm trong vệt chu kỳ 10 năm và 100 năm. Không kết luận đường không ngập sau mưa.", "JRC Global River Flood Hazard.", "thap", "ô mô hình"),
            m("Ngập đường khi mưa", "Chưa đủ chuỗi quan trắc.", "Chưa nối dữ liệu thoát nước.", "thieu", "điểm đã lưu"),
            m("Mảng xanh", "Khoảng 11% ô thực vật trong 300 m. Không thay cho công viên có tên.", "ESA WorldCover 10 m.", "trung-binh", "300 m"),
            m("Quy hoạch theo thửa", "Chưa có dữ liệu. Cổng quy hoạch Hà Nội chưa có API theo tọa độ.", "Chưa nối quyhoach.hanoi.gov.vn.", "thieu", "thửa"),
          ],
        },
      ],
    },
    {
      id: "hoan-kiem",
      title: "Cạnh Hồ Gươm",
      address: "Gần hồ Hoàn Kiếm, phường Hoàn Kiếm, Hà Nội",
      lat: 21.0302,
      lng: 105.8512,
      image: "images/ho-hoan-kiem.webp",
      imageAlt: "Hồ Hoàn Kiếm và tháp Rùa, ảnh khu vực minh họa.",
      coverage: "86 chỗ",
      coverageHint: "Dày hơn một ngõ nội thành thông thường",
      priceContext: "noi-thanh",
      queries: ["ho guom", "hoan kiem", "ho hoan kiem", "thap rua"],
      geocodeNote: "Điểm mẫu sát Hồ Gươm. Vẫn kéo ghim nếu ô đất nằm trong ngõ, không nằm trên đường lớn.",
      summary:
        "Ghim sát hồ Hoàn Kiếm, cách mốc Hồ Gươm khoảng 200 m. Trong 500 m thấy 86 chỗ trên bản đồ mở, trong đó 8 hiệu thuốc và 2 siêu thị. Công viên hồ cách khoảng 40 m. Điểm xe buýt khoảng 80 m. Đường gần nhất có tag vỉa hè hai bên; đó là vỉa hè của đường gần ghim, không suy ra mặt tiền của một thửa trong ngõ. Ga metro đang chạy gần nhất khoảng 2,5 km, ngoài bán kính 2 km. Trạm không khí cách khoảng 1,4 km. Chưa có quy hoạch theo thửa, và chưa đủ chuỗi ngập khi mưa.",
      strengths: [
        "Công viên hồ cách khoảng 40 m.",
        "Tiện ích đi bộ dày: 86 chỗ trong 500 m.",
        "Đường gần nhất có tag vỉa hè hai bên.",
      ],
      gaps: [
        "Tag vỉa hè thuộc đường gần ghim, không phải mặt tiền thửa.",
        "Ga metro ngoài 2 km.",
        "Chưa có quy hoạch theo thửa và chưa đủ chuỗi ngập mưa.",
      ],
      kpis: [
        { label: "Mức phủ trong 500 m", value: "86 chỗ", hint: "Dày hơn ngõ Văn Miếu" },
        { label: "Tới công viên hồ", value: "40 m", hint: "Công viên có tên" },
        { label: "Tới Hồ Gươm", value: "200 m", hint: "Mốc nội đô cố định" },
      ],
      groups: [
        {
          title: "Tiện ích đi bộ, 500 m",
          intro: "Khu trung tâm có nhiều điểm hơn. Số đếm vẫn kèm mức phủ, không phải mọi cửa đã được vẽ.",
          metrics: [
            m("Chợ", "1 chợ trong 500 m, khoảng 320 m.", "OpenStreetMap, amenity=marketplace.", "trung-binh", "500 m"),
            m("Hiệu thuốc", "8 hiệu thuốc. Gần nhất khoảng 60 m.", "OpenStreetMap, amenity=pharmacy.", "cao", "500 m"),
            m("Siêu thị", "2 siêu thị. Gần nhất khoảng 200 m.", "OpenStreetMap, shop=supermarket.", "trung-binh", "500 m"),
            m("Cửa hàng tiện lợi", "7 điểm. Gần nhất khoảng 70 m.", "OpenStreetMap, shop=convenience.", "trung-binh", "500 m"),
            m("Quán ăn, cà phê", "41 điểm trong 500 m.", "OpenStreetMap, restaurant, cafe, fast_food.", "trung-binh", "500 m"),
            m("Công viên", "Công viên hồ cách khoảng 40 m.", "OpenStreetMap, leisure=park.", "cao", "500 m"),
            m("Trường học", "Trường gần nhất khoảng 260 m. Không xếp hạng trường tốt.", "OpenStreetMap, amenity=school.", "trung-binh", "500 m"),
            m("Bệnh viện", "3 bệnh viện trong 2 km. Gần nhất khoảng 900 m.", "OpenStreetMap, amenity=hospital.", "trung-binh", "2 km"),
          ],
        },
        {
          title: "Đi lại và đường",
          intro: "Vỉa hè chỉ hiện khi có tag, và tag đó thuộc đường gần nhất.",
          metrics: [
            m("Đường lớn", "Đường primary gần nhất khoảng 25 m.", "OpenStreetMap, highway=primary.", "cao", "tới đường gần nhất"),
            m("Cấp đường gần ghim", "Đường primary, tag lanes=4. Không có width từng mét.", "OpenStreetMap, highway, lanes.", "trung-binh", "đoạn gần ghim"),
            m("Vỉa hè", "Đường gần nhất có sidewalk=both. Không suy ra vỉa hè của một ngõ khuất.", "OpenStreetMap, sidewalk.", "trung-binh", "đường gần ghim"),
            m("Tới nội đô", "Khoảng 200 m tới Hồ Gươm.", "Mốc cố định Hồ Gươm.", "cao", "một điểm"),
            m("Ga metro", "Ga đang chạy gần nhất khoảng 2,5 km, ngoài 2 km.", "Sơ đồ ga khai thác và OpenStreetMap.", "trung-binh", "2 km"),
            m("Điểm xe buýt", "Điểm dừng gần nhất khoảng 80 m.", "GTFS Hà Nội và OpenStreetMap.", "cao", "500 m"),
            m("Khoảng cách tới nguồn ồn", "Khoảng 2,2 km tới motorway hoặc trunk. Khoảng 22 km tới Nội Bài.", "OpenStreetMap.", "trung-binh", "tới điểm gần nhất"),
          ],
        },
        {
          title: "Dân số, không khí, địa hình",
          intro: "Trạm không khí đủ gần để gán kèm khoảng cách. Ngập mưa vẫn thiếu chuỗi.",
          metrics: [
            m("Dân số ước tính", "Khoảng 11.200 người trong vòng 500 m.", "WorldPop 100 m, R2025A.", "trung-binh", "500 m"),
            m("Không khí", "Trạm cách khoảng 1,4 km. PM2.5 khoảng 31 µg/m³ lúc 14:00 ngày 18/10/2026.", "OpenAQ.", "trung-binh", "3 km"),
            m("Cao độ", "Khoảng 10,1 m, gần trung vị 500 m (chênh 0,1 m).", "FABDEM.", "trung-binh", "ô 30 m và 500 m"),
            m("Ngập sông mô hình", "Không nằm trong vệt JRC chu kỳ 10 năm và 100 năm. Không kết luận về ngập đường.", "JRC Global River Flood Hazard.", "thap", "ô mô hình"),
            m("Ngập đường khi mưa", "Chưa đủ chuỗi quan trắc.", "Chưa nối dữ liệu thoát nước.", "thieu", "điểm đã lưu"),
            m("Mảng xanh", "Khoảng 18% ô thực vật trong 300 m, chủ yếu nhờ mặt hồ và cây ven hồ.", "ESA WorldCover 10 m.", "trung-binh", "300 m"),
            m("Quy hoạch theo thửa", "Chưa có dữ liệu.", "Chưa có API theo tọa độ.", "thieu", "thửa"),
          ],
        },
      ],
    },
    {
      id: "dong-anh",
      title: "Gần Nội Bài",
      address: "Khu dân cư phía nam sân bay Nội Bài, huyện Đông Anh, Hà Nội",
      lat: 21.205,
      lng: 105.82,
      image: "images/noi-bai.webp",
      imageAlt: "Sân bay Nội Bài nhìn từ xa, ảnh khu vực minh họa.",
      coverage: "6 chỗ",
      coverageHint: "Báo cáo mỏng, không phải khu trống",
      priceContext: "ngoai-thanh",
      queries: ["noi bai", "dong anh", "san bay noi bai"],
      geocodeNote: "Khu ngoại thành mẫu. Bản đồ mở thưa, nên báo cáo tiện ích sẽ mỏng.",
      summary:
        "Ghim ở phía nam sân bay Nội Bài. Trong 500 m chỉ thấy 6 chỗ trên bản đồ mở, nên hầu hết tiện ích đi bộ đều mỏng. Hiệu thuốc gần nhất khoảng 1,2 km, ngoài bán kính 500 m. Trường gần nhất khoảng 740 m. Điểm xe buýt khoảng 350 m. Sân bay cách khoảng 2,3 km và đường trunk cách khoảng 400 m; cả hai chỉ là khoảng cách, không phải đo tiếng ồn. Cao độ khoảng 8 m, thấp hơn trung vị 500 m khoảng 1,4 m. Mô hình sông cho độ sâu khoảng 0,4 m ở chu kỳ 10 năm và khoảng 1,1 m ở chu kỳ 100 năm tại ô này. Trạm không khí gần nhất khoảng 4,8 km, xa hơn 3 km nên không gán chỉ số cho ô đất. Chưa có quy hoạch theo thửa.",
      strengths: [
        "Điểm xe buýt khoảng 350 m, vẫn trong 500 m.",
        "Mảng xanh trong 300 m khoảng 34%, cao hơn hai điểm nội thành mẫu.",
      ],
      gaps: [
        "Chỉ 6 chỗ trong 500 m. Báo cáo tiện ích đi bộ mỏng.",
        "Hiệu thuốc, chợ và siêu thị đều ngoài 500 m hoặc không thấy.",
        "Trạm không khí xa hơn 3 km, không gán cho ô.",
        "Có số độ sâu ngập sông mô hình, nhưng không phải ngập đường khi mưa.",
        "Chưa có quy hoạch theo thửa.",
      ],
      kpis: [
        { label: "Mức phủ trong 500 m", value: "6 chỗ", hint: "Báo cáo mỏng" },
        { label: "Tới sân bay Nội Bài", value: "2,3 km", hint: "Khoảng cách, không phải decibel" },
        { label: "Tới Hồ Gươm", value: "21 km", hint: "Xa mốc nội đô" },
      ],
      groups: [
        {
          title: "Tiện ích đi bộ, 500 m",
          intro: "Số thấp nghĩa là lớp bản đồ mỏng tại khu này, không phải kết luận không có cửa hàng.",
          metrics: [
            m("Chợ", "Không thấy chợ trong 500 m. Chợ gần nhất trên lớp hiện có khoảng 1,6 km.", "OpenStreetMap, amenity=marketplace.", "thap", "500 m"),
            m("Hiệu thuốc", "Không thấy trong 500 m. Gần nhất khoảng 1,2 km.", "OpenStreetMap, amenity=pharmacy.", "thap", "500 m"),
            m("Siêu thị", "Không thấy siêu thị trong 2 km trên lớp hiện có.", "OpenStreetMap, shop=supermarket.", "thap", "500 m"),
            m("Cửa hàng vật tư", "0 điểm. Phủ yếu. Không kết luận khu không có.", "OpenStreetMap, shop=hardware.", "thap", "500 m"),
            m("Quán ăn, cà phê", "3 điểm trong 500 m.", "OpenStreetMap, restaurant, cafe, fast_food.", "thap", "500 m"),
            m("Công viên", "Không thấy công viên có tên trong 1 km.", "OpenStreetMap, leisure=park.", "thap", "500 m"),
            m("Trường học", "Trường gần nhất khoảng 740 m, ngoài 500 m.", "OpenStreetMap, amenity=school.", "trung-binh", "500 m"),
            m("Bệnh viện", "Không thấy bệnh viện trong 2 km. Gần nhất khoảng 3,4 km.", "OpenStreetMap, amenity=hospital.", "trung-binh", "2 km"),
          ],
        },
        {
          title: "Đi lại và đường",
          intro: "Gần đường trunk và sân bay chỉ được báo bằng khoảng cách.",
          metrics: [
            m("Đường lớn", "Đường trunk gần nhất khoảng 400 m.", "OpenStreetMap, highway=trunk.", "cao", "tới đường gần nhất"),
            m("Cấp đường gần ghim", "Đường residential. Không có width. Không rõ xe lớn vào được hay không.", "OpenStreetMap, highway.", "thap", "đoạn gần ghim"),
            m("Vỉa hè", "Không có tag sidewalk. Không rõ.", "OpenStreetMap, sidewalk.", "thieu", "đoạn gần ghim"),
            m("Tới nội đô", "Khoảng 21 km tới Hồ Gươm.", "Mốc cố định Hồ Gươm.", "cao", "một điểm"),
            m("Ga metro", "Không có ga đang chạy trong 2 km.", "Sơ đồ ga khai thác.", "cao", "2 km"),
            m("Điểm xe buýt", "Điểm dừng gần nhất khoảng 350 m.", "GTFS Hà Nội và OpenStreetMap.", "trung-binh", "500 m"),
            m("Khoảng cách tới nguồn ồn", "Khoảng 400 m tới đường trunk. Khoảng 2,3 km tới sân bay Nội Bài. Không có bản đồ tiếng ồn.", "OpenStreetMap.", "trung-binh", "tới điểm gần nhất"),
          ],
        },
        {
          title: "Dân số, không khí, địa hình",
          intro: "Trạm không khí quá xa thì bỏ khỏi kết luận của ô. Ngập sông và ngập mưa là hai việc khác nhau.",
          metrics: [
            m("Dân số ước tính", "Khoảng 1.200 người trong vòng 500 m. Thưa hơn hai điểm nội thành mẫu.", "WorldPop 100 m, R2025A.", "trung-binh", "500 m"),
            m("Không khí", "Trạm gần nhất khoảng 4,8 km, xa hơn 3 km. Không gán chỉ số cho ô đất.", "OpenAQ.", "thieu", "3 km"),
            m("Cao độ", "Khoảng 8 m, thấp hơn trung vị 500 m khoảng 1,4 m. Không ghi dễ ngập từ riêng số này.", "FABDEM.", "trung-binh", "ô 30 m và 500 m"),
            m("Ngập sông mô hình", "Độ sâu mô hình khoảng 0,4 m ở chu kỳ 10 năm và khoảng 1,1 m ở chu kỳ 100 năm. Không phải bản đồ ngập Hà Nội.", "JRC Global River Flood Hazard.", "thap", "ô mô hình"),
            m("Ngập đường khi mưa", "Chưa đủ chuỗi quan trắc.", "Chưa nối dữ liệu thoát nước.", "thieu", "điểm đã lưu"),
            m("Mảng xanh", "Khoảng 34% ô thực vật trong 300 m. Không có công viên có tên gần đó.", "ESA WorldCover 10 m.", "trung-binh", "300 m"),
            m("Quy hoạch theo thửa", "Chưa có dữ liệu.", "Chưa có API theo tọa độ.", "thieu", "thửa"),
          ],
        },
      ],
    },
  ];

  function fold(value) {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d");
  }

  function distanceMeters(aLat, aLng, bLat, bLng) {
    const rad = Math.PI / 180;
    const dLat = (bLat - aLat) * rad;
    const dLng = (bLng - aLng) * rad;
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function getPlace(id) {
    return places.find((place) => place.id === id) || null;
  }

  function searchPlaces(query) {
    const folded = fold(query.trim());
    if (!folded) return places.slice();
    return places.filter((place) => {
      const blob = fold([place.title, place.address, place.queries.join(" ")].join(" "));
      return folded.split(/\s+/).every((part) => blob.includes(part));
    });
  }

  function nearest(lat, lng) {
    return places
      .map((place) => ({ place, meters: distanceMeters(lat, lng, place.lat, place.lng) }))
      .sort((a, b) => a.meters - b.meters)[0];
  }

  const BANDS = {
    "noi-thanh": { dat: [150, 260], "nha-pho": [120, 190], "can-ho": [55, 95] },
    "ngoai-thanh": { dat: [18, 40], "nha-pho": [28, 55], "can-ho": [22, 38] },
  };

  const KIND_LABEL = { dat: "Đất", "nha-pho": "Nhà phố", "can-ho": "Căn hộ" };
  const LEGAL_LABEL = { so: "Có sổ", "hop-dong": "Hợp đồng, chưa sổ", vuong: "Đang vướng quy hoạch" };
  const CONFIDENCE_LABEL = { cao: "Tin cậy cao", "trung-binh": "Tin cậy trung bình", thap: "Tin cậy thấp", thieu: "Thiếu dữ liệu" };

  function parseDecimal(raw) {
    if (raw === null || raw === undefined) return null;
    const text = String(raw).trim().replace(/\s/g, "");
    if (!text) return null;
    const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
  }

  function formatTy(value) {
    return (
      new Intl.NumberFormat("vi-VN", {
        minimumFractionDigits: value >= 10 ? 0 : 1,
        maximumFractionDigits: value >= 10 ? 1 : 2,
      }).format(value) + " tỷ"
    );
  }

  function formatTrieu(value) {
    return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value) + " triệu/m²";
  }

  function evaluate(input, place) {
    if (!input.kind) return { status: "refuse", reason: "Chưa chọn loại hình." };
    if (!input.legal) {
      return { status: "refuse", reason: "Thiếu pháp lý nên chưa kết luận khung giá." };
    }
    if (input.legal === "vuong") {
      return {
        status: "refuse",
        reason: "Bạn khai ô đang vướng quy hoạch. Bản này không kết luận giá khi pháp lý chưa rõ.",
      };
    }
    const area = parseDecimal(input.area);
    if (area === null || area <= 0 || area > 100000) {
      return { status: "refuse", reason: "Cần diện tích lớn hơn 0 để tính giá mỗi mét vuông." };
    }

    const band = BANDS[place.priceContext][input.kind];
    let low = band[0];
    let high = band[1];
    const widened = [];
    if (input.legal === "hop-dong") {
      low *= 0.85;
      high *= 1.25;
      widened.push("Pháp lý là hợp đồng, chưa phải sổ, nên khung được nới rộng.");
    }
    const needsFrontage = input.kind === "dat" || input.kind === "nha-pho";
    const frontage = parseDecimal(input.frontage);
    if (needsFrontage && (frontage === null || frontage <= 0)) {
      low *= 0.75;
      high *= 1.35;
      widened.push("Thiếu mặt tiền. Khung phải rộng hơn, không thu hẹp được.");
    }
    if (input.kind === "can-ho" && !String(input.floors || "").trim()) {
      low *= 0.9;
      high *= 1.15;
      widened.push("Thiếu số tầng. Khung căn hộ được nới nhẹ.");
    }
    const asking = parseDecimal(input.asking);
    return {
      status: "range",
      lowTy: (low * area) / 1000,
      highTy: (high * area) / 1000,
      lowPerM2: low,
      highPerM2: high,
      area,
      asking,
      widened,
      kindLabel: KIND_LABEL[input.kind],
      legalLabel: LEGAL_LABEL[input.legal],
      assumptions: [
        "Khung này là số minh họa trong bản mock, chưa phải mô hình giá đã khóa.",
        "Chưa có giá giao dịch. Giá rao trên sàn nhà đất không được dùng.",
        "Bảng giá đất nhà nước 2026 chưa được khớp tên đường, nên chưa đưa vào.",
        "Các chỉ số vị trí không được nhân thành một mức giá bán.",
        "Pháp lý, diện tích và mặt tiền do bạn tự khai. Hệ thống không kiểm chứng hồ sơ.",
      ],
    };
  }

  const posts = [
    {
      id: "ghim",
      featured: true,
      title: "Kéo ghim, vì địa chỉ hay lệch",
      excerpt: "Bộ đổi địa chỉ thành tọa độ có thể lệch vài chục đến vài trăm mét, nhất là ngõ. Báo cáo bám điểm bạn đặt.",
      date: "18/10/2026",
      iso: "2026-10-18",
      image: "images/ngo-ha-noi-ngang.webp",
      imageAlt: "Ngõ Hà Nội với cửa hàng hai bên, ảnh khu vực minh họa.",
      paragraphs: [
        "Ô tìm chỉ đưa bạn tới gần. Ở ngõ Hà Nội, điểm geocode có thể rơi ra mặt đường hoặc sang một ngõ khác. Vì vậy bước đầu là kéo ghim vào đúng ô đất.",
        "Mọi khoảng cách trong báo cáo tính từ ghim, không tính từ chuỗi địa chỉ. Nếu ghim lệch, hiệu thuốc “90 m” cũng lệch theo.",
        "Ba điểm đã đo trên trang chủ là số mẫu để đọc cách báo cáo nói. Chấm một chỗ chưa đo thì trang ghi chưa có số, không điền tiện ích.",
      ],
    },
    {
      id: "thieu-du-lieu",
      title: "Số tiện ích thấp không có nghĩa khu trống",
      excerpt: "Không thấy cửa hàng trong bán kính thì ghi thiếu, kèm nguồn. Bản đồ mỏng khác với kết luận khu không có.",
      date: "16/10/2026",
      iso: "2026-10-16",
      image: "images/noi-bai.webp",
      imageAlt: "Sân bay Nội Bài nhìn từ xa, ảnh khu vực minh họa.",
      paragraphs: [
        "OpenStreetMap ở Hà Nội dày ở phố lớn và mỏng ở ngõ, ngoại thành. Điểm gần Nội Bài trong bản mẫu chỉ thấy 6 chỗ trong 500 m.",
        "Câu đúng là “không thấy trên lớp hiện có”. Câu sai là “khu này không có cửa hàng”. Mỗi chỉ số vì vậy kèm số điểm và mức tin.",
        "Cửa hàng vật tư, vỉa hè và trụ sở phường là những mục hay thiếu tag. Thiếu thì để trống có chủ đích, không suy diễn.",
      ],
    },
    {
      id: "khung-gia",
      title: "Khung giá không phải giá bán",
      excerpt: "Giá chỉ thành một khoảng sau khi bạn tự khai loại hình, pháp lý, diện tích và mặt tiền. Không chốt một mức từ địa chỉ.",
      date: "14/10/2026",
      iso: "2026-10-14",
      image: "images/ho-hoan-kiem.webp",
      imageAlt: "Hồ Hoàn Kiếm và tháp Rùa, ảnh khu vực minh họa.",
      paragraphs: [
        "Giá giao dịch thật gần như không công khai. Giá rao là giá chào. Bảng giá đất của UBND là mốc tính thuế, không phải giá bán.",
        "Bản mock chỉ ra một khoảng minh họa. Thiếu mặt tiền thì khoảng nới rộng. Bạn khai đang vướng quy hoạch thì không kết luận giá.",
        "Gói miễn phí dừng ở điểm mạnh và điểm yếu. Một lần định giá riêng trong bảng giá là 10.000 đồng. Số tháng và năm trên trang vẫn là mức minh họa, chưa chốt.",
      ],
    },
    {
      id: "ban-kinh",
      title: "Ba bán kính đã chốt",
      excerpt: "500 m cho tiện ích đi bộ, 2 km cho bệnh viện và metro, 3 km là ngưỡng còn gán trạm không khí.",
      date: "12/10/2026",
      iso: "2026-10-12",
      image: "images/ho-tay.webp",
      imageAlt: "Hồ Tây lúc hoàng hôn, ảnh khu vực minh họa.",
      paragraphs: [
        "Đây là thước đo của sản phẩm, không phải số người dùng. Đổi bán kính trên bản đồ tra cứu chỉ để thấy vòng đó quanh điểm đã chọn.",
        "Ga metro chỉ tính ga đang chạy. Ngoài 2 km thì ghi ngoài bán kính, không viết thành “xa metro” như một lời khuyên.",
        "Trạm không khí xa hơn 3 km thì không gán chỉ số cho ô đất. Khoảng cách tới sân bay hoặc đường lớn là khoảng cách, không phải đo tiếng ồn.",
      ],
    },
    {
      id: "khong-ket-luan-ngap",
      title: "Không kết luận dễ ngập từ một con số",
      excerpt: "Có cao độ tương đối và độ sâu ngập sông theo mô hình. Không có bản đồ ngập đường sau mưa của Hà Nội.",
      date: "10/10/2026",
      iso: "2026-10-10",
      image: "images/ngo-ha-noi.webp",
      imageAlt: "Ngõ nhỏ ở Hà Nội, nhà và mái hiên hai bên, ảnh khu vực minh họa.",
      paragraphs: [
        "Cao độ thấp hơn trung vị xung quanh chỉ là một so sánh. Nó không đủ để ghi “khu này dễ ngập”.",
        "Mô hình sông JRC cho một độ sâu theo chu kỳ 10 năm và 100 năm. Đó không phải bản đồ ngập úng sau mưa của thành phố.",
        "Chưa nối dữ liệu thoát nước nên mục ngập đường khi mưa ghi chưa đủ chuỗi. Báo cáo để trống phần đó.",
      ],
    },
  ];

  function getPost(id) {
    return posts.find((post) => post.id === id) || null;
  }

  window.LIData = {
    places,
    posts,
    getPost,
    getPlace,
    searchPlaces,
    nearest,
    evaluate,
    parseDecimal,
    formatTy,
    formatTrieu,
    KIND_LABEL,
    LEGAL_LABEL,
    CONFIDENCE_LABEL,
    UPDATED,
  };
})();
