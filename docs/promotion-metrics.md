# Promotion counters

Admin → Баннер: existing total views/clicks, with explicit refresh. Banner impressions require >=50% viewport visibility for 750ms, focused route, foreground app and no Home modal overlay. Once per banner ID per mounted carousel; no render-driven increments. These are total exposure counters, not unique-user analytics.

Admin → Мэдэгдэл: total views and explicit refresh. Modal onShow records once per announcement ID per mounted Home screen. Closing/dismissing is not a CTA click; announcements currently have no linked action.

Announcement counting begins with the new client build. Historic missing views cannot be reconstructed. Inactive, future and expired announcements do not increment server counters. Concurrent increments are atomic. Counters are informational, not billing or fraud-proof analytics.

Validation: tests/promotion-metrics.cjs; tests/announcement-migration-smoke.sql (schema and fixtures rolled back).
