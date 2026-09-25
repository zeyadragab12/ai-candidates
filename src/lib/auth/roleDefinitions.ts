export const ROLES = ["admin", "hr_manager", "hr_user"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  hr_manager: "HR Manager",
  hr_user: "HR User",
};
