export default function NotFound() {
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
      <h1 style={{ fontSize: "4rem", fontWeight: 700, margin: 0, color: "#5B5FEF" }}>404</h1>
      <p style={{ fontSize: "1.125rem", color: "#94a3b8", margin: 0 }}>
        This page could not be found.
      </p>
      <a
        href="/overview"
        style={{
          display: "inline-block",
          padding: "0.75rem 1.5rem",
          background: "#5B5FEF",
          color: "#fff",
          borderRadius: "0.5rem",
          textDecoration: "none",
          fontWeight: 500,
          fontSize: "0.875rem",
        }}
      >
        Go to Overview
      </a>
    </div>
  );
}
