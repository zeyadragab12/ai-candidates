import { DashboardNav } from "@/components/dashboard/nav";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

export default function AdminLoading() {
  return (
    <main className="min-h-screen bg-slate-50/70">
      <DashboardNav />
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <SkeletonBlock className="h-36 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <SkeletonBlock className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <SkeletonBlock className="h-7 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <SkeletonBlock className="h-5 w-40" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="h-4 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
