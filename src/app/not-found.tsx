import Link from "next/link";



export default function NotFound() {
  return (
    <div
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
      }}
    >
      <h1 style={{ fontSize: "4rem", fontWeight: 700, margin: 0, color: "#5B5FEF" }}>404</h1>
      <p style={{ fontSize: "1.125rem", color: "hsl(var(--text-secondary))", margin: 0 }}>
        This page could not be found.
      </p>
      <Link
        href="/dashboard"
        style={{
          marginTop: "1rem",
          padding: "0.5rem 1.25rem",
          background: "#5B5FEF",
          color: "#fff",
          borderRadius: "0.5rem",
          textDecoration: "none",
          fontSize: "0.875rem",
          fontWeight: 500,
        }}
      >
        Back to dashboard
      </Link>
    </div>
  );
}
