/**
 * Release switches for features that are already implemented but not ready for
 * public use. Keep the data/schema in place so the feature can be enabled
 * again without a destructive migration.
 */
export const RENTAL_INSURANCE_ENABLED = false;

// Owner-requested dual-payment variant. This is NOT store-policy approval.
// Static, review-visible switch: never change payment availability based on reviewer identity.
export const NATIVE_QPAY_ENABLED = true;
