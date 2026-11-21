-- ============================================================
-- Vincula cada reparto entregado a su liquidación, para no liquidarlo dos veces.
-- ============================================================
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS payout_id uuid REFERENCES public.courier_payouts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deliveries_payout ON public.deliveries(payout_id);
