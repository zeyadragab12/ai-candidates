import { redirect } from "next/navigation";

import { DashboardNav } from "@/components/dashboard/nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen">
      <DashboardNav />
      <div className="p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Signed in as</p>
            <p data-testid="account-email" className="font-medium">
              {user.email}
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
