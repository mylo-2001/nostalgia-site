DROP TABLE IF EXISTS marketing_campaign_recipients;
DROP TABLE IF EXISTS marketing_campaigns;
ALTER TABLE promotions DROP COLUMN IF EXISTS send_marketing_email;
