import type { SynonymRule } from '../../integrations/elasticsearch/elasticsearch.service.js';

/**
 * Nguồn chuẩn của bộ từ đồng nghĩa `vi-common` (FR-12). Áp dụng bằng PUT idempotent khi ES sẵn sàng,
 * nên mất ES không mất từ đồng nghĩa. Tìm kiếm đã bỏ dấu nên dạng có dấu và không dấu là một.
 *
 * Đây là DANH SÁCH MẪU cần chủ dự án duyệt. Không thêm viết tắt một chữ cái (`q`, `p`): quá mơ hồ.
 */
export const VI_COMMON_SYNONYMS: readonly SynonymRule[] = [
  { id: 'benh-vien', synonyms: 'bv, bệnh viện, benh vien' },
  { id: 'chung-cu', synonyms: 'cc, chung cư, chung cu' },
  { id: 'thanh-pho', synonyms: 'tp, thành phố, thanh pho' },
];
