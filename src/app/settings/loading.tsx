import { DashboardNav } from "@/components/dashboard/nav";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function SettingsLoading() {
  return (
    <main className="min-h-screen">
      <DashboardNav />
      <div className="p-4">
        <Card className="max-w-md">
          <CardHeader>
            <div className="h-5 w-24 animate-pulse rounded-md bg-muted" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="h-4 w-32 animate-pulse rounded-md bg-muted" />
            <div className="h-5 w-48 animate-pulse rounded-md bg-muted" />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
