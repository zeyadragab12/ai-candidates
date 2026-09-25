const ALLOWED_EMAILS = [
  "zeyad.ragab@thegdevelopments.com",
  "amr.fayez@thegdevelopments.com",
  "zeyadragab12@gmail.com",
  "zeyadboyka6@gmail.com",
];

export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  return ALLOWED_EMAILS.includes(email.trim().toLowerCase());
}

/**
 * Supabase creates an auth user — and our signup trigger a profile — for
 * anyone who completes Google sign-in, before the allowlist turns them
 * away. Those leftovers are never allowed in and were never given a team
 * or elevated role, so user lists and reports skip them.
 */
export function isRejectedSignup(profile: {
  email: string;
  role: string;
  team_id: string | null;
}): boolean {
  return profile.role === "hr_user" && profile.team_id === null && !isEmailAllowed(profile.email);
}
