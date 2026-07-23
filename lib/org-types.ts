export type OrgRole = "owner" | "admin" | "member";

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
