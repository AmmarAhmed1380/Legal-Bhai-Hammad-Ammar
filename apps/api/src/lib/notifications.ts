import type { CaseRecord, HearingLog, NotificationType } from "@wakeel/shared";

interface NotificationContext {
  caseRecord: CaseRecord;
  hearing?: HearingLog | null;
}

export function renderNotificationPreview(type: NotificationType, context: NotificationContext): string {
  const { caseRecord, hearing } = context;

  if (type === "post_hearing") {
    const nextDate = hearing?.nextDateGiven ?? caseRecord.nextDate ?? "To be confirmed";
    const status = hearing?.notes?.trim() || "Updated in Wakeel";
    return [
      `Dear ${caseRecord.clientName}, your case ${caseRecord.rawCaseNumber} was heard today.`,
      `Next date: ${nextDate}.`,
      `Status: ${status}.`,
      "- Wakeel demo",
    ].join(" ");
  }

  return [
    `Dear ${caseRecord.clientName}, your case ${caseRecord.rawCaseNumber} is listed on ${caseRecord.nextDate ?? "the listed hearing date"}.`,
    `Court: ${caseRecord.court}.`,
    `Urdu preview: Aap ka muqadma ${caseRecord.rawCaseNumber} ki tareekh ${caseRecord.nextDate ?? "maloom hone par"} hai.`,
    "- Wakeel demo",
  ].join(" ");
}
