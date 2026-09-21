import { DashboardNav } from "@/components/dashboard/nav";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <main className="min-h-screen">
      <DashboardNav />
      <div className="flex flex-col gap-6 p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <SkeletonBlock className="h-5 w-32" />
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <SkeletonBlock className="h-4 w-full" />
                <SkeletonBlock className="h-4 w-3/4" />
                <SkeletonBlock className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
