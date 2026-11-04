# Agreed pricing — 2026-11-03

QPay MNT: bump 1200; credit1 3200; credit2 5200; credit3 7200;
sponsor 1/7/30 days: 4000/20000/60000.

Advertising quote (not an automatic IAP product):
banner 1/7/30 days: 12000/60000/180000 MNT;
welcome announcement 1/7/30 days: 16000/80000/240000 MNT.
Maximum initial contract: 30 days; no annual fixed-price commitment.
Placement is shared/rotating, not exclusive.

Deployed 2026-11-04: applied only 20261103000000_qpay_price_update.sql and
deployed qpay-service to wrekrjaitokrqydkwgtg. Confirmed new prices present,
anon/authenticated execution denied and service_role execution allowed.
The updated client still requires an owner-built binary. Do not enable real store purchases.
Existing pending invoices retain their stored amounts.

Store prices are loaded from Apple/Google, not overwritten with fixed MNT.
Owner must update the consoles. Proposed USD equivalents using the agreed
4000 MNT planning rate: bump 0.29; credit1/2/3 0.79/1.29/1.79;
sponsor1/2/3 0.99/4.99/14.99. Confirm available price points before saving.
Fixed QPay prices are not a guarantee of the card's final FX conversion.

Remaining release gates:
- Test all seven products on TestFlight and Android internal testing.
- Confirm the store sheet explicitly identifies sandbox/test payment before confirming.
- Verify correct credits, bump, and sponsorship duration after server confirmation.
- Cancel a purchase; retry/recover an interrupted purchase without double granting.
- Confirm refund handling with test events and consumed/unused credits.
- Supply IAP review screenshots, metadata, and reviewer access.
- Resolve QPay digital-service policy compliance before public review;
  displaying both payment methods is not evidence of approval.
- Review the bank/payment verification status separately.
