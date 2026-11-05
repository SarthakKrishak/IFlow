import { Metadata } from "next";
import { DeploymentsClient } from "./DeploymentsClient";

export const metadata: Metadata = {
  title: "Deployments — IFlow",
  description: "Live system health and deployment history.",
};

export default function DeploymentsPage() {
  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <DeploymentsClient />
      </div>
    </div>
  );
}
