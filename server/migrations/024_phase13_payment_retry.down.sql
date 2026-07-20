DO $$
DECLARE previous_definition TEXT;
BEGIN
  SELECT definition INTO previous_definition
    FROM phase13_order_state_guard_backup WHERE singleton=TRUE;
  IF previous_definition IS NULL THEN
    RAISE EXCEPTION 'Phase 13 state guard backup is missing';
  END IF;
  EXECUTE previous_definition;
END;
$$;

DROP TABLE phase13_order_state_guard_backup;
