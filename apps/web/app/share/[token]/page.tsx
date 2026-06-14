import { publicRequest } from "../../../lib/api";

interface SharedPayload {
  caseRecord: {
    rawCaseNumber: string;
    court: string;
    title: string;
    nextDate: string | null;
    clientName: string;
  };
  latestHearing: {
    hearingDate: string;
    outcome: string;
    notes: string;
    nextDateGiven: string | null;
    imageUrl: string | null;
    ocrText: string | null;
  } | null;
}

export default async function SharePage({
  params,
}: {
  params: { token: string };
}) {
  const { token } = params;
  const payload = await publicRequest<SharedPayload>(`/share/${token}`);

  return (
    <main className="page-shell">
      <section className="panel share-card">
        <div className="eyebrow">Client Portal</div>
        <h1 className="title" style={{ marginBottom: 6 }}>
          {payload.caseRecord.rawCaseNumber}
        </h1>
        <p className="muted">{payload.caseRecord.title}</p>
        <div className="info-list">
          <div><strong>Court:</strong> {payload.caseRecord.court}</div>
          <div><strong>Next date:</strong> {payload.caseRecord.nextDate ?? "To be confirmed"}</div>
          <div><strong>Client:</strong> {payload.caseRecord.clientName}</div>
        </div>

        <div className="panel" style={{ marginTop: 20 }}>
          <h2 style={{ marginTop: 0 }}>Latest update</h2>
          {payload.latestHearing ? (
            <>
              <div><strong>Date:</strong> {payload.latestHearing.hearingDate}</div>
              <div><strong>Outcome:</strong> {payload.latestHearing.outcome}</div>
              <p className="muted">{payload.latestHearing.notes}</p>
              {payload.latestHearing.nextDateGiven ? (
                <div><strong>Next date given:</strong> {payload.latestHearing.nextDateGiven}</div>
              ) : null}
            </>
          ) : (
            <p className="muted">No hearing update has been shared yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
