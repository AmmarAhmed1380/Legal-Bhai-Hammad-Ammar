import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-shell">
      <section className="auth-card" style={{ textAlign: "center", maxWidth: 520, margin: "0 auto" }}>
        <div className="eyebrow">404</div>
        <h1 className="title">Page not found</h1>
        <p className="muted">The page you are looking for does not exist or has been moved.</p>
        <div className="actions" style={{ marginTop: 24, justifyContent: "center" }}>
          <Link className="button" href="/">
            Back to login
          </Link>
        </div>
      </section>
    </main>
  );
}
