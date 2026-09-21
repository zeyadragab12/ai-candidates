const ALLOWED_EMAILS = ["zeyad.ragab@thegdevelopments.com", "amr.fayez@thegdevelopments.com"];

export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  return ALLOWED_EMAILS.includes(email.trim().toLowerCase());
}
