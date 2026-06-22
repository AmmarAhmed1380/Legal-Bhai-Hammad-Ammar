"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f4f7f5", color: "#10241c" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <section style={{ maxWidth: 480, textAlign: "center" }}>
            <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Error
            </p>
            <h1 style={{ margin: "0 0 12px", fontSize: 28 }}>Something went wrong</h1>
            <p style={{ margin: "0 0 20px", color: "#4f6b61" }}>
              An unexpected error occurred. You can try again or return to the login page.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => reset()}
                style={{ border: 0, borderRadius: 999, padding: "12px 18px", background: "#0f6b4d", color: "#fff", cursor: "pointer" }}
              >
                Try again
              </button>
              <a href="/" style={{ borderRadius: 999, padding: "12px 18px", background: "#fff", color: "#0f6b4d", textDecoration: "none" }}>
                Back to login
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
