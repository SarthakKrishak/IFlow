"use client";

import NextTopLoader from "nextjs-toploader";

export function TopLoader() {
  return (
    <NextTopLoader
      color="#5B5FEF"
      initialPosition={0.08}
      crawlSpeed={200}
      height={3}
      crawl={true}
      showSpinner={false}
      easing="ease"
      speed={200}
      shadow="0 0 10px #5B5FEF,0 0 5px #5B5FEF"
      zIndex={1600}
      showAtBottom={false}
    />
  );
}
