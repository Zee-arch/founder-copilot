// Shared across app/actions/orgs.ts (writes it), app/api/generate/route.ts
// and dashboard pages (read it) — kept in one place so the name can't drift.
export const ACTIVE_ORG_COOKIE = "active_org_id";
