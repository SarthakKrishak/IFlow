"use client";

import { useEffect } from "react";

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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f1117",
        color: "#e2e8f0",
        fontFamily: "system-ui, sans-serif",
        gap: "1rem",
      }}
    >
      <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: 0 }}>Something went wrong</h1>
      <p style={{ color: "#94a3b8", margin: 0 }}>An error occurred while rendering this page.</p>
      <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
        <button
          onClick={reset}
          style={{
            padding: "0.5rem 1.25rem",
            background: "#5B5FEF",
            color: "#fff",
            borderRadius: "0.5rem",
            border: "none",
            cursor: "pointer",
            fontSize: "0.875rem",
            fontWeight: 500,
          }}
        >
          Try again
        </button>
        <a
          href="/overview"
          style={{
            padding: "0.5rem 1.25rem",
            background: "transparent",
            color: "#94a3b8",
            borderRadius: "0.5rem",
            border: "1px solid #2d3748",
            textDecoration: "none",
            fontSize: "0.875rem",
            fontWeight: 500,
          }}
        >
          Go to Overview
        </a>
      </div>
    </div>
  );
}
