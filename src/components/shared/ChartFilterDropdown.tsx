"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function ChartFilterDropdown() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentRange = searchParams?.get("range") || "7d";

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRange = e.target.value;
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("range", newRange);
    router.push(`?${params.toString()}`);
  };

  return (
    <select 
      value={currentRange}
      onChange={handleChange}
      className="bg-transparent text-[13px] text-muted-foreground font-medium outline-none cursor-pointer"
    >
      <option value="7d" className="bg-surface-elevated">Last 7 Days</option>
      <option value="30d" className="bg-surface-elevated">Last 30 Days</option>
    </select>
  );
}
