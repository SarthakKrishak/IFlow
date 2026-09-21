"use client";

import dynamic from "next/dynamic";
import { PageSkeleton } from "@/components/shared/Skeletons";

// recharts is heavy — load it on demand so first paint stays fast
const OverviewDashboardInner = dynamic(
  () => import("./OverviewDashboard").then((m) => m.OverviewDashboard),
  { ssr: false, loading: () => <PageSkeleton /> }
);

export function OverviewDashboardLoader(props: React.ComponentProps<typeof OverviewDashboardInner>) {
  return <OverviewDashboardInner {...props} />;
}
