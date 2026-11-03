# Phân tích chữ và truy vấn (017-search-elasticsearch)

Mọi cấu hình dưới đây đã được **chạy thử trên ES 9.2.0** (không plugin). Tên theo `.cursor/rules/naming.md`: analyzer/filter `snake_case`, trường `camelCase`. Ví dụ dùng trường `title`; profile thật thay bằng trường của mình.

## 1. Bộ phân tích dùng chung

Tiếng Việt viết theo âm tiết cách nhau bằng dấu cách, nên tokenizer `standard` đã tách đúng âm tiết; không cần plugin tách từ.

```json
{
  "analysis": {
    "char_filter": {
      "strip_combining": {
        "type": "pattern_replace",
        "pattern": "[\\u0300-\\u036f]",
        "replacement": ""
      }
    },
    "filter": {
      "shingle_compact": {
        "type": "shingle",
        "min_shingle_size": 2,
        "max_shingle_size": 3,
        "token_separator": "",
        "output_unigrams": true
      },
      "synonym_vi": {
        "type": "synonym_graph",
        "synonyms_set": "vi-common",
        "updateable": true
      }
    },
    "analyzer": {
      "vi_exact": {
        "type": "custom",
        "tokenizer": "standard",
        "filter": ["lowercase"]
      },
      "vi_fold": {
        "type": "custom",
        "char_filter": ["strip_combining"],
        "tokenizer": "standard",
        "filter": ["lowercase", "asciifolding"]
      },
      "vi_compact": {
        "type": "custom",
        "char_filter": ["strip_combining"],
        "tokenizer": "standard",
        "filter": ["lowercase", "asciifolding", "shingle_compact"]
      },
      "vi_fold_synonym": {
        "type": "custom",
        "char_filter": ["strip_combining"],
        "tokenizer": "standard",
        "filter": ["lowercase", "asciifolding", "synonym_vi"]
      }
    }
  }
}
```

| Thành phần | Vai trò | Đã kiểm chứng |
| --- | --- | --- |
| `strip_combining` | Gỡ dấu rời Unicode (chuỗi NFD) trước khi tách từ | `"Hoàn Kiếm"` dạng NFD → `hoan`, `kiem` |
| `asciifolding` | Bỏ dấu của chữ dựng sẵn (NFC), **gồm `đ → d`** | `"Đồng Xuân"` → `dong`, `xuan` |
| `vi_exact` | Giữ dấu, chỉ hạ chữ thường → thưởng điểm cho khớp **đúng dấu** | Phrase có dấu điểm cao nhất |
| `vi_compact` | Lập chỉ mục thêm các cụm 2–3 âm tiết **dính liền** | `"Hoàn Kiếm"` → `hoan`, `hoankiem`, `kiem` |
| `vi_fold_synonym` | Chỉ dùng lúc **tìm**; thêm từ đồng nghĩa | `bv bach mai` → "Bệnh viện Bạch Mai" |

Ghi chú:

- Backend vẫn chuẩn hóa `q` về **NFC** (`String.prototype.normalize('NFC')`) trước khi gửi, thêm một lớp an toàn.
- Giữ `max_shingle_size - min_shingle_size ≤ 1` để không phải chỉnh `index.max_shingle_diff`.
- `synonym_vi` yêu cầu **bộ `vi-common` phải tồn tại trước khi tạo index** (tài liệu Elastic: index tham chiếu bộ không tồn tại sẽ hỏng, phải xóa tạo lại hoặc đóng/mở lại).
- Theo tài liệu match query: **fuzzy bị bỏ qua với từ có từ đồng nghĩa**. Chấp nhận được: từ viết tắt ngắn không cần fuzzy.

## 2. Mapping mẫu cho trường văn bản ngắn

```json
{
  "dynamic": "strict",
  "properties": {
    "title": {
      "type": "text",
      "analyzer": "vi_exact",
      "fields": {
        "fold":    { "type": "text", "analyzer": "vi_fold", "search_analyzer": "vi_fold_synonym" },
        "compact": { "type": "text", "analyzer": "vi_compact", "search_analyzer": "vi_fold" },
        "sayt":    { "type": "search_as_you_type", "analyzer": "vi_fold" }
      }
    },
    "cityId":    { "type": "keyword" },
    "status":    { "type": "keyword" },
    "createdAt": { "type": "date" },
    "updatedAt": { "type": "date" }
  }
}
```

- Trường `search_as_you_type` tự sinh `title.sayt._2gram`, `._3gram`, `._index_prefix` (tài liệu Elastic); truy vấn đề xuất là `multi_match` kiểu `bool_prefix` trên gốc + `_2gram` + `_3gram`.
- **Trường dài** (nội dung): chỉ `text` + `fold`, **không** `compact`, **không** `sayt`, không fuzzy (BR-05).
- Trường lọc là `keyword`/`date`/`boolean`; không dùng `text` để lọc.
- Cài đặt index: `number_of_shards: 1`, `number_of_replicas: 0`; `refresh_interval` theo profile (mặc định 5 giây; 1 giây nếu cần thấy kết quả sớm).
- `_source` được giữ nhưng chỉ dùng cho reindex/gỡ lỗi; truy vấn tìm kiếm đặt `_source: false` (chỉ lấy `_id`, `_score`).

## 3. Truy vấn nhiều tầng

Mỗi tầng là một mệnh đề `should`; điểm cộng dồn nên bản ghi khớp nhiều tầng đứng trên. `minimum_should_match: 1`.

| # | Tầng | Mệnh đề | Boost | Bắt lỗi nào |
| --- | --- | --- | --- | --- |
| T1 | Cụm đúng có dấu | `match_phrase` trên `title` | 10 | Gõ đúng |
| T2 | Cụm đúng không dấu | `match_phrase` trên `title.fold` | 6 | Không dấu, sai dấu |
| T3 | Đủ từ, đảo thứ tự | `match` `title.fold`, `operator: and` | 4 | Đảo từ, gõ thiếu từ |
| T4 | Chữ dính | `match` `title.compact`, `operator: and` | 3 | `hoankiem` |
| T5 | Sai chính tả | `match` `title.fold`, `operator: and`, `fuzziness: AUTO`, `prefix_length: 1`, `max_expansions: 20` | 2 | Đảo/sai/thừa/thiếu chữ cái |
| T6 | Gõ dở | `multi_match` `bool_prefix` trên `title.sayt` + `_2gram` + `_3gram` | 2 | `bach ma` |
| T7 | Khớp một phần | `match` `title.fold`, `minimum_should_match: 60%` | 1 | Người dùng gõ thừa từ |

```json
{
  "size": 20,
  "_source": false,
  "timeout": "2s",
  "track_total_hits": false,
  "query": {
    "bool": {
      "filter": [ { "term": { "status": "published" } } ],
      "should": [
        { "match_phrase": { "title":      { "query": "<q>", "boost": 10 } } },
        { "match_phrase": { "title.fold": { "query": "<q>", "boost": 6 } } },
        { "match": { "title.fold":    { "query": "<q>", "operator": "and", "boost": 4 } } },
        { "match": { "title.compact": { "query": "<q>", "operator": "and", "boost": 3 } } },
        { "match": { "title.fold": { "query": "<q>", "operator": "and", "fuzziness": "AUTO", "prefix_length": 1, "max_expansions": 20, "boost": 2 } } },
        { "multi_match": { "query": "<q>", "type": "bool_prefix", "fields": ["title.sayt", "title.sayt._2gram", "title.sayt._3gram"], "boost": 2 } },
        { "match": { "title.fold": { "query": "<q>", "minimum_should_match": "60%", "boost": 1 } } }
      ],
      "minimum_should_match": 1
    }
  }
}
```

Tham số, đối chiếu tài liệu Elastic:

- `fuzziness: AUTO`: độ dài từ 0–2 phải khớp đúng; 3–5 cho sai 1; > 5 cho sai 2 (mặc định `AUTO:3,6`). Âm tiết tiếng Việt thường 2–5 chữ nên đa số được 1 lỗi.
- `fuzzy_transpositions` mặc định `true`: **đảo hai chữ liền nhau tính là 1 lỗi** (`keim` ↔ `kiem`). `match` **không** nhận tham số tên `transpositions` (lỗi `400` khi thử).
- `prefix_length: 1`: giữ nguyên chữ đầu, giảm số từ phải mở rộng và nhiễu. Hệ quả: lỗi ở **chữ cái đầu** của một âm tiết không được cứu bởi fuzzy (xem hạn chế).
- `max_expansions: 20` (mặc định 50) giới hạn chi phí.
- Nhiều trường trong một profile: sinh các mệnh đề này cho từng trường tìm kiếm, nhân boost trường (ví dụ `title` ×3, `address` ×1).

### Quy tắc cắt nhiễu và tie-break

- Lấy điểm cao nhất `maxScore` của trang; loại kết quả `_score < scoreRatioMin × maxScore` (`scoreRatioMin = 0.15`). Khi sắp xếp theo trường khác, đặt `track_scores: true` để vẫn có điểm.
- Sắp xếp mặc định: `_score desc`, rồi `tieBreaker` của profile (ví dụ `updatedAt desc` hoặc độ phổ biến), rồi `_id`. Thử nghiệm cho thấy các bản ghi ngang điểm xuất hiện thường xuyên (xem "Hồ Hoàn Kiếm" và "Quận Hoàn Kiếm" cùng điểm).
- Điểm BM25 phụ thuộc thống kê kho dữ liệu. **Thứ tự tầng** (tầng cao thắng) ổn định nhờ boost, nhưng **ngưỡng 15%** phải kiểm lại trên dữ liệu thật.

## 4. Kết quả thử nghiệm (2026-11-03)

Thực hiện trên ES dev 9.2.0 bằng index tạm 12 tài liệu địa danh (đã xóa). Đây là **thử nghiệm trên kho nhỏ**, dùng để kiểm cơ chế, không phải số đo chất lượng.

| Truy vấn người dùng | Kiểu lỗi | Hạng 1 | Điểm hạng 1 |
| --- | --- | --- | --- |
| `Hoàn Kiếm` | đúng | Hồ Hoàn Kiếm | 85,5 |
| `hoan kiem` | không dấu | Hồ Hoàn Kiếm | 56,1 |
| `kiem hoan` | đảo từ | Hồ Hoàn Kiếm | 36,4 |
| `hoankiem` | dính chữ | Hồ Hoàn Kiếm | 5,4 |
| `hoan kiêm` | sai dấu | Hồ Hoàn Kiếm | 56,1 |
| `hoan keim` | đảo hai chữ cái | Hồ Hoàn Kiếm | 9,6 |
| `hoan kiam` | sai 1 chữ cái | Hồ Hoàn Kiếm | 9,6 |
| `hoan kiemm` | thừa 1 chữ cái | Hồ Hoàn Kiếm | 9,6 |
| `hon kiem` | thiếu 1 chữ cái | Hồ Hoàn Kiếm | 9,9 |
| `ho hoan kiem ha noi` | thừa từ | Hồ Hoàn Kiếm | 29,6 |
| `nguyen cu` | thiếu từ | Nguyễn Văn Cừ | 45,3 |
| `bach ma` | gõ dở | Bệnh viện Bạch Mai | 10,5 |
| `dong xuan cho` | đảo từ | Chợ Đồng Xuân | 87,2 |
| `ha dong` | `đ → d` | Hà Đông | 69,0 |
| `thang lonh` | sai chữ + thiếu | Trường tiểu học Thăng Long | 12,2 |
| `zzzzqq` | không liên quan | (không có kết quả) | — |

Quan sát:

1. **Tất cả 15 ca có nghĩa đều ra đúng ở hạng 1.** Thứ tự điểm theo tầng đúng kỳ vọng: đúng có dấu (85) > không dấu (56) > đảo từ (36) > sai chính tả (≈10).
2. **Nhiễu có điểm thấp rõ rệt:** các kết quả không liên quan lọt vào (ví dụ "Phở bò Hà Nội" cho `ha dong`, "Công viên Thống Nhất" cho `benh vien bach mai`) chỉ có 2–7% điểm cao nhất, trong khi kết quả đúng thấp nhất có 30% (`ho hoan kiem ha noi` → "Quận Hoàn Kiếm"). Do đó ngưỡng 15% hợp lý, **cần kiểm lại trên dữ liệu thật**.
3. **Điểm tuyệt đối thấp ≠ sai.** Ca `hoankiem` điểm 5,4 vẫn là kết quả đúng duy nhất; vì vậy dùng **tỉ lệ so với điểm cao nhất**, không dùng `min_score` tuyệt đối.
4. **Từ đồng nghĩa:** với Synonyms API + `synonym_graph` + `updateable`: `bv bach mai` và `BV Bạch Mai` → "Bệnh viện Bạch Mai"; `q hoan kiem` → "Quận Hoàn Kiếm". Sau khi cập nhật bộ từ đồng nghĩa (thêm `tt ≈ thống nhất`), truy vấn `tt cong vien` ra "Công viên Thống Nhất" **ngay**, ES tự nạp lại analyzer (`reloaded_analyzers: ["vi_fold_synonym"]`), không reindex.

### Hạn chế đã biết (không phải lỗi, cần chấp nhận hoặc xử lý sau)

- **Lỗi ở chữ cái đầu của một âm tiết** (ví dụ `koan kiem` thay cho `hoan kiem`): theo định nghĩa `prefix_length: 1` (giữ nguyên chữ đầu) fuzzy sẽ không cứu được ca này. **Chưa thử trong phiên này.** Nếu bộ ca thật cho thấy cần, thử `prefix_length: 0` cho trường ngắn và đo lại nhiễu/chi phí.
- **Sai dấu thay đổi nghĩa** (`ma` / `má` / `mả`) bị bỏ qua vì tìm không dấu; hạng nhờ T1 (đúng dấu) vẫn đưa kết quả đúng dấu lên trước.
- **Dính chữ ngược** (kho lưu `hoankiem`, người dùng gõ `hoan kiem`): thiết kế hiện tại không có tầng riêng cho ca này. **Chưa thử**; được cho là hiếm với dữ liệu ghi theo chuẩn.
- Một số cụm viết tắt cần bổ sung vào bộ từ đồng nghĩa dần theo dữ liệu thật (`hn`, `hcm`, `q.1`…).
- Không có ngữ nghĩa theo nghĩa "hiểu ý" (đúng yêu cầu: không dùng AI).

## 5. Bộ ca kiểm thử cho triển khai

Khi triển khai, giữ bộ ca vàng (golden queries) cạnh profile: tệp JSON `{ q, expectedId, maxRank }`, chạy như **integration test** với ES thật dựng bằng index tạm có tiền tố `test-` (không dùng dữ liệu dev, xóa sau khi chạy). Bắt buộc có đủ các nhóm FR-03 và vài ca "không được trả kết quả". Theo `testing-policy.md`: không e2e; test dựa trên đặc tả này, không dựa trên đầu ra hiện tại của mã.
