-- 007-billing: bảng yêu cầu hoàn tiền. Production chạy TYPEORM_SYNCHRONIZE=false nên tạo tay một lần.
-- Idempotent: chạy lại không lỗi. Khớp entity backend/src/modules/billing/entities/refund-request.entity.ts.
-- Chạy: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/scripts/sql/2026-11-08-refund-requests.sql
BEGIN;

CREATE TABLE IF NOT EXISTS refund_requests (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  order_id uuid NOT NULL REFERENCES payment_orders (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  reason varchar(24) NOT NULL,
  amount_vnd integer NOT NULL CHECK (amount_vnd > 0),
  status varchar(16) NOT NULL DEFAULT 'requested',
  user_note varchar(500),
  payout_account_name varchar(120),
  payout_account_number varchar(32),
  payout_bank varchar(64),
  decision_note varchar(500),
  decided_by uuid,
  decided_at timestamptz,
  payout_reference varchar(64),
  paid_out_at timestamptz,
  CONSTRAINT chk_refund_requests_reason CHECK (reason IN
    ('within_24h','service_outage','operator_stop','duplicate_or_wrong','overpay','legal')),
  CONSTRAINT chk_refund_requests_status CHECK (status IN
    ('requested','approved','rejected','paid_out'))
);

CREATE INDEX IF NOT EXISTS idx_refund_requests_status_created
  ON refund_requests (status, created_at);
CREATE INDEX IF NOT EXISTS idx_refund_requests_order
  ON refund_requests (order_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_refund_requests_order_reason_open
  ON refund_requests (order_id, reason)
  WHERE status <> 'rejected' AND deleted_at IS NULL;

COMMIT;
