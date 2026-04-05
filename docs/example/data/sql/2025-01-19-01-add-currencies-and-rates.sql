-- SQLite dialect

INSERT INTO currencies ("iso_4217_code") VALUES ('USD'), ('JPY');

INSERT INTO currency_rates ("currency_id", "rate_in_usd", "valid_from")
VALUES
	(
		(SELECT id FROM currencies WHERE iso_4217_code = 'USD'),
		1,

		-- valid from the first date for the sessions table entries
		COALESCE(COALESCE((SELECT MIN("created_at") FROM "sessions"), strftime('%s', 'now')), strftime('%s', 'now'))
	),
	(
		(SELECT id FROM currencies WHERE iso_4217_code = 'JPY'),
		0.0064,

		-- valid from the first date for the sessions table entries
		COALESCE(COALESCE((SELECT MIN("created_at") FROM "sessions"), strftime('%s', 'now')), strftime('%s', 'now'))
	)
;
