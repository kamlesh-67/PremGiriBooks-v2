// Static route-segment -> label lookup for the Breadcrumb Bar. Deliberately
// simple (no per-entity name fetching) — a segment not listed here falls
// back to a capitalized version of the raw segment, and a UUID-shaped
// segment (a resource id) is dropped from the visible trail entirely rather
// than showing a raw id, per BREADCRUMB_ID_PATTERN below.
export const BREADCRUMB_LABELS: Record<string, string> = {
  masters: "Masters",
  profile: "My Profile",
  company: "Company Management",
  "financial-year": "Financial Year Management",
  branch: "Branch Management",
  settings: "Settings",
  users: "User Management",
  roles: "Roles & Permissions",
  new: "New",
  edit: "Edit",
  select: "Select",
};

export const BREADCRUMB_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
