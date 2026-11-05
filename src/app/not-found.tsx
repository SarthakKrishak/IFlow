import Link from "next/link";
import { buttonStyles } from "@/components/ui/styles";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-background text-foreground p-6 text-center">
      <div>
        <p className="text-[13px] font-mono text-muted-foreground">Error 404</p>
        <h1 className="text-display text-[48px] mt-2">Nothing <em className="text-muted-foreground">here.</em></h1>
        <p className="text-[14px] text-muted-foreground mt-2 max-w-sm">
          The link may be out of date, or you may not have access to it.
        </p>
      </div>
      <Link href="/overview" className={buttonStyles("primary", "lg")}>
        Go to Overview
      </Link>
    </div>
  );
}
