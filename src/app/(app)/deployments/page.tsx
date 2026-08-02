import { Metadata } from "next";
import { Server } from "lucide-react";
import { DeploymentsClient } from "./DeploymentsClient";

export const metadata: Metadata = {
  title: "Deployments — IFlow",
  description: "Live system health and deployment history.",
};

export default function DeploymentsPage() {
  return (
    <div className="h-full w-full flex flex-col bg-surface-base">
      <div className="flex items-center justify-between px-8 py-6 border-b border-surface-border shrink-0 bg-surface-base">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Server size={24} className="text-primary" />
            Infrastructure & Deployments
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">Live tracking of Vercel and Railway services.</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <DeploymentsClient />
      </div>
    </div>
  );
}
