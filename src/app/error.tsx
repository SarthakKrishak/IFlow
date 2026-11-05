"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-background text-foreground p-6 text-center">
      <div>
        <h1 className="text-display text-[48px]">Something <em className="text-muted-foreground">broke.</em></h1>
        <p className="text-[14px] text-muted-foreground mt-2 max-w-sm">
          An error occurred while loading this page. You can try again, or head back to the overview.
        </p>
        {error.digest && <p className="text-[11px] font-mono text-muted-foreground/70 mt-3">Ref: {error.digest}</p>}
      </div>
      <div className="flex gap-2">
        <Button variant="primary" size="lg" onClick={reset}>
          <RotateCw size={15} /> Try again
        </Button>
        <Link href="/overview" className={buttonStyles("secondary", "lg")}>
          Go to Overview
        </Link>
      </div>
    </div>
  );
}
