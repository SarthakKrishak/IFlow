"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/shared/Skeletons";

// recharts is heavy — load it on demand so first paint stays fast
const GithubTrackerInner = dynamic(
  () => import("./GithubTracker").then((m) => m.GithubTracker),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

export function GithubTrackerLoader(props: React.ComponentProps<typeof GithubTrackerInner>) {
  return <GithubTrackerInner {...props} />;
}
