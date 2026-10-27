// Canonical proposed USD/month catalog. Regenerate the SQL seed after edits.
export const PLANS = {
  free: {
    name: "Free",
    monthlyCents: 0,
    currency: "USD",
    applications: 25,
    favorites: 5,
    milestones: 20,
    aiMonthly: 0,
    cloud: false,
    kanban: false,
    analytics: false,
    advancedPlanning: false,
  },
  pro: {
    name: "Pro",
    monthlyCents: 900,
    currency: "USD",
    applications: 1000,
    favorites: 100,
    milestones: 1000,
    aiMonthly: 25,
    cloud: true,
    kanban: true,
    analytics: true,
    advancedPlanning: true,
  },
  premium: {
    name: "Premium",
    monthlyCents: 1900,
    currency: "USD",
    applications: 1000,
    favorites: 200,
    milestones: 1000,
    aiMonthly: 100,
    cloud: true,
    kanban: true,
    analytics: true,
    advancedPlanning: true,
  },
};
export const BILLING_DISCLOSURE =
  "Proposed monthly prices in USD. Tax and any proration are shown by Paddle before confirmation. Paid features require an activated, verified commercial backend. Existing portfolio tools remain available.";
export const OPERATION_LIMITS = {
  aiDaily: 10,
  aiPlatformDaily: 100,
  billingProviderDaily: 50,
  billingStatusDaily: 300,
};
// Existing 4.x accounts retain the previous per-collection bounds and 10/day AI capacity.
export const LEGACY_LIMITS = {
  applications: 1000,
  favorites: 1000,
  milestones: 1000,
  aiMonthly: 310,
  cloud: true,
  kanban: true,
  analytics: true,
  advancedPlanning: true,
};
