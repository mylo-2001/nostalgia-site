CREATE TABLE phase13_order_state_guard_backup (
  singleton  BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  definition TEXT NOT NULL
);

INSERT INTO phase13_order_state_guard_backup (definition)
SELECT pg_get_functiondef('nostalgia_validate_order_state_transition()'::regprocedure);

CREATE OR REPLACE FUNCTION nostalgia_validate_order_state_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF OLD.order_status_v2 IS NOT NULL AND NEW.order_status_v2 IS DISTINCT FROM OLD.order_status_v2
       AND (CASE OLD.order_status_v2
         WHEN 'draft' THEN NEW.order_status_v2 IN ('pending','cancelled')
         WHEN 'pending' THEN NEW.order_status_v2 IN ('confirmed','requires_review','cancelled')
         WHEN 'confirmed' THEN NEW.order_status_v2 IN ('processing','requires_review','cancelled')
         WHEN 'processing' THEN NEW.order_status_v2 IN ('ready_to_ship','requires_review','cancelled')
         WHEN 'ready_to_ship' THEN NEW.order_status_v2 IN ('processing','completed','cancelled')
         WHEN 'requires_review' THEN NEW.order_status_v2 IN ('confirmed','cancelled')
         ELSE FALSE END) IS NOT TRUE THEN
      RAISE EXCEPTION 'Invalid order status transition: % -> %',OLD.order_status_v2,NEW.order_status_v2
        USING ERRCODE='23514';
    END IF;
    IF OLD.payment_status_v2 IS NOT NULL AND NEW.payment_status_v2 IS DISTINCT FROM OLD.payment_status_v2
       AND (CASE OLD.payment_status_v2
         WHEN 'pending' THEN NEW.payment_status_v2 IN ('authorized','paid','failed','cancelled','cod_pending')
         WHEN 'authorized' THEN NEW.payment_status_v2 IN ('paid','failed','cancelled')
         WHEN 'paid' THEN NEW.payment_status_v2 IN ('partially_refunded','refunded')
         WHEN 'partially_refunded' THEN NEW.payment_status_v2='refunded'
         WHEN 'cod_pending' THEN NEW.payment_status_v2 IN ('cod_collected','cancelled')
         WHEN 'cod_collected' THEN NEW.payment_status_v2 IN ('partially_refunded','refunded')
         WHEN 'failed' THEN NEW.payment_status_v2='pending'
         ELSE FALSE END) IS NOT TRUE THEN
      RAISE EXCEPTION 'Invalid payment status transition: % -> %',OLD.payment_status_v2,NEW.payment_status_v2
        USING ERRCODE='23514';
    END IF;
    IF OLD.shipping_status_v2 IS NOT NULL AND NEW.shipping_status_v2 IS DISTINCT FROM OLD.shipping_status_v2
       AND (CASE OLD.shipping_status_v2
         WHEN 'not_ready' THEN NEW.shipping_status_v2='ready'
         WHEN 'ready' THEN NEW.shipping_status_v2 IN ('not_ready','label_created')
         WHEN 'label_created' THEN NEW.shipping_status_v2 IN ('ready','handed_to_courier')
         WHEN 'handed_to_courier' THEN NEW.shipping_status_v2 IN ('in_transit','returning')
         WHEN 'in_transit' THEN NEW.shipping_status_v2 IN ('delivered','delivery_failed','returning')
         WHEN 'delivery_failed' THEN NEW.shipping_status_v2 IN ('in_transit','returning','returned')
         WHEN 'delivered' THEN NEW.shipping_status_v2='returning'
         WHEN 'returning' THEN NEW.shipping_status_v2='returned'
         ELSE FALSE END) IS NOT TRUE THEN
      RAISE EXCEPTION 'Invalid shipping status transition: % -> %',OLD.shipping_status_v2,NEW.shipping_status_v2
        USING ERRCODE='23514';
    END IF;
  END IF;
  IF NEW.order_status_v2 IS NOT NULL AND NEW.payment_status_v2 IS NOT NULL
     AND NEW.shipping_status_v2 IS NOT NULL THEN
    IF NEW.order_status_v2 IN ('confirmed','processing','ready_to_ship')
       AND NEW.payment_status_v2 NOT IN ('authorized','paid','partially_refunded','cod_pending','cod_collected') THEN
      RAISE EXCEPTION 'Order status % requires payment ready for fulfilment',NEW.order_status_v2 USING ERRCODE='23514';
    END IF;
    IF NEW.order_status_v2='completed' AND NEW.shipping_status_v2 NOT IN ('delivered','returning','returned') THEN
      RAISE EXCEPTION 'Completed order requires delivered or return shipping status' USING ERRCODE='23514';
    END IF;
    IF NEW.order_status_v2='completed' AND NEW.payment_status_v2 NOT IN
       ('paid','partially_refunded','refunded','cod_collected') THEN
      RAISE EXCEPTION 'Completed order requires settled payment status' USING ERRCODE='23514';
    END IF;
    IF NEW.shipping_status_v2 IN ('ready','label_created','handed_to_courier','in_transit',
       'delivered','delivery_failed','returning','returned')
       AND NEW.order_status_v2 NOT IN ('confirmed','processing','ready_to_ship','completed')
       AND NOT (NEW.order_status_v2='cancelled' AND NEW.shipping_status_v2 IN
         ('delivery_failed','returning','returned')) THEN
      RAISE EXCEPTION 'Shipping status % is incompatible with order status %',
        NEW.shipping_status_v2,NEW.order_status_v2 USING ERRCODE='23514';
    END IF;
    IF NEW.payment_status_v2='cod_collected' AND NEW.shipping_status_v2 NOT IN
       ('delivered','returning','returned') THEN
      RAISE EXCEPTION 'COD cannot be collected before delivery' USING ERRCODE='23514';
    END IF;
    IF NEW.payment_method_v2='card' AND NEW.payment_status_v2 LIKE 'cod_%' THEN
      RAISE EXCEPTION 'Card payment cannot use COD payment status' USING ERRCODE='23514';
    END IF;
    IF NEW.payment_method_v2='cod' AND NEW.payment_status_v2 IN ('authorized','paid') THEN
      RAISE EXCEPTION 'COD payment cannot use card payment status' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION nostalgia_validate_order_state_transition() IS
  'V2 state guard. Failed card payments may return to pending only for an idempotent retry.';
