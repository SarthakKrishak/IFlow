"use client";


export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "hsl(var(--surface-base))",
          color: "hsl(var(--text-primary))",
          fontFamily: "system-ui, sans-serif",
          gap: "1rem",
          margin: 0,
        }}
      >
        <h2 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
          Something went wrong
        </h2>
        <button
          onClick={reset}
          style={{
            padding: "0.5rem 1.25rem",
            background: "#5B5FEF",
            color: "#fff",
            border: "none",
            borderRadius: "0.5rem",
            cursor: "pointer",
            fontSize: "0.875rem",
            fontWeight: 500,
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
