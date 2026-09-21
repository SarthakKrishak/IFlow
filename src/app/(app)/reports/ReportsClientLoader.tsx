"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/shared/Skeletons";

// recharts is heavy — load it on demand so first paint stays fast
const ReportsClientInner = dynamic(
  () => import("./ReportsClient").then((m) => m.ReportsClient),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

export function ReportsClientLoader(props: React.ComponentProps<typeof ReportsClientInner>) {
  return <ReportsClientInner {...props} />;
}
