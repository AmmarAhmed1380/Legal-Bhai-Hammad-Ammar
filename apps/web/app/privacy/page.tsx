import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <div className="privacy-policy-page">
      <div className="privacy-policy-shell">
        <div className="privacy-policy-back">
          <Link className="privacy-policy-back-link" href="/">
            ← Return to Portal Login
          </Link>
        </div>

        <header className="privacy-policy-header">
          <h1 className="privacy-policy-title">Data Protection &amp; Privacy Policy</h1>
          <p className="privacy-policy-updated">Last Updated: June 2026 • LegalBahi Production Platform</p>
        </header>

        <div className="privacy-policy-body">
          <section>
            <h2>1. Scope of Policy &amp; Zero-Trust Architecture</h2>
            <p>
              LegalBahi operates as an invite-only legal practice management system built specifically for solo advocates and their respective clients. This policy governs how data is captured, isolated, and encrypted across our Fastify HTTP API, Next.js web ecosystem, and React Native mobile services. Our platform operates on a <strong>Zero-Trust Framework</strong>—ensuring absolute separation of legal matters, client threads, and case documentation between distinct legal firms.
            </p>
          </section>

          <section>
            <h2>2. Protection of Advocate-Client Privilege</h2>
            <p>
              We recognize that data uploaded to LegalBhai is protected by strict legal professional privilege. LegalBahi asserts no ownership over any information, case details, or documentation uploaded. Every piece of data is structurally partitioned at the database layer using strict firm-level boundaries, ensuring that no member of any outside organization can enumerate or discover pending matters, hearings, or client rosters.
            </p>
          </section>

          <section>
            <h2>3. Document Pipeline &amp; Object Storage Security</h2>
            <p>
              When an advocate or client uploads a document (including orders, petitions, evidence, or Vakalatnamas), the file is instantly routed through a multi-tier security pipeline:
            </p>
            <ul>
              <li><strong>Magic-Byte Validation:</strong> Files are analyzed at the structural layer to prevent extension-spoofing attacks.</li>
              <li><strong>Malware Screening:</strong> Uploads undergo automated virus scanning before execution.</li>
              <li><strong>Isolated R2 Vaults:</strong> Authorized documents are saved inside private, non-public Cloudflare R2 object storage buckets, accessible only via temporary, token-scoped requests.</li>
            </ul>
          </section>

          <section>
            <h2>4. Automated Court Ingestion &amp; Scraping Data</h2>
            <p>
              LegalBahi continuously checks public cause-lists from the Islamabad High Court (IHC), Lahore High Court (LHC) Rawalpindi Bench, and local District Courts to alert lawyers to upcoming hearings and schedule conflicts. This scraping framework parses publicly available cause-lists to synchronize calendars. No private firm data or case strategies are ever exposed to external court networks during these verification updates.
            </p>
          </section>

          <section>
            <h2>5. Authentication, JWT Sessions, &amp; Notifications</h2>
            <p>
              LegalBahi utilizes an advanced OTP (One-Time Password) infrastructure backed by cryptographic hashing to completely eliminate passwords, mitigating identity theft risks. Access sessions are secured using 15-minute JSON Web Tokens (JWT) combined with rotating 30-day refresh tokens. System-generated communications—such as automatic hearing reminders or calendar adjustments—are dispatched securely via Twilio SMS and Resend email channels following explicit client authorization.
            </p>
          </section>

          <section className="privacy-policy-footer-note">
            <p>
              For security incident reporting, database disaster recovery strategies, or questions regarding our encrypted data retention guidelines, please consult the system administrator.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
