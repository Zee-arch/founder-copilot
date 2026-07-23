export type OrgRole = "owner" | "admin" | "member";

export type Org = {
  id: string;
  name: string;
  slug: string;
  created_by: string;
  created_at: string;
};

export type OrgWithRole = Org & { role: OrgRole };

export type OrgMemberRow = {
  user_id: string;
  role: OrgRole;
  created_at: string;
  email: string;
  display_name: string | null;
};

export type OrgInviteRow = {
  id: string;
  email: string;
  role: Exclude<OrgRole, "owner">;
  token: string;
  created_at: string;
  expires_at: string;
};

export function canManageOrg(role: OrgRole): boolean {
  return role === "owner" || role === "admin";
}
