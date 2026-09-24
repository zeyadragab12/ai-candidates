/**
 * Derives a human-friendly display name from an email address, since this
 * app has no profiles/names table — email is the only identity on record
 * (see src/lib/auth/allowlist.ts). "zeyad.ragab@..." -> "Zeyad Ragab".
 */
export function getDisplayName(email: string | null | undefined): string | null {
  if (!email) return null;
  const localPart = email.split("@")[0];
  if (!localPart) return null;

  return localPart
    .split(/[.\-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
