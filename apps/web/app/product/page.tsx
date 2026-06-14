import Link from "next/link";

export default function ProductHomePage() {
  return (
    <main className="page-shell">
      <section className="panel share-card" style={{ maxWidth: 920 }}>
        <div className="eyebrow">LegalBahi</div>
        <h1 className="title">Secure legal practice workspace</h1>
        <p className="muted" style={{ maxWidth: 640 }}>
          Manage matters, hearing dates, IHC cause-list matches, private documents, reminders, and
          protected client updates.
        </p>
        <div className="actions" style={{ marginTop: 24 }}>
          <Link className="button" href="/overview">
            Open staff workspace
          </Link>
          <Link className="button-secondary" href="/client">
            Open client workspace
          </Link>
        </div>
      </section>
    </main>
  );
}
