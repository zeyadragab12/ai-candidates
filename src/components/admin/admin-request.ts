import { toast } from "@/components/ui/toast";

/** Sends an admin mutation and surfaces the API's own error message on failure. */
export async function sendAdminRequest(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body: unknown,
): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(payload?.error ?? "The change could not be saved.");
      return false;
    }
    return true;
  } catch {
    toast.error("Network error — the change could not be saved.");
    return false;
  }
}
