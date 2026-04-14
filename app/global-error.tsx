"use client";

/**
 * Root-level fallback when the root layout or critical providers fail.
 * Must define its own <html> and <body> (Next.js requirement).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
          color: "#f5f5f5",
          fontFamily: "system-ui, sans-serif",
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: 11, letterSpacing: "0.15em", color: "#ff8c00", fontWeight: 600 }}>
          CRITICAL ERROR
        </p>
        <h1 style={{ marginTop: 12, maxWidth: 480, fontSize: "1.125rem" }}>
          {error.message || "The app shell failed to load."}
        </h1>
        <p style={{ marginTop: 16, maxWidth: 520, fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
          Check the browser console (F12 → Console) and your terminal running{" "}
          <code style={{ color: "#ccc" }}>npm run dev</code>. After a macOS or Cursor update, confirm{" "}
          <code style={{ color: "#ccc" }}>.env.local</code> still has real Clerk and Supabase values
          (not placeholders), then restart the dev server.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: 24,
            padding: "10px 20px",
            fontWeight: 600,
            fontSize: 13,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            border: "2px solid #ff8c00",
            background: "#ff8c00",
            color: "#000",
            cursor: "pointer",
            borderRadius: 2,
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
