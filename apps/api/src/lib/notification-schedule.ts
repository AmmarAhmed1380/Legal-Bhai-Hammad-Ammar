const PAKISTAN_OFFSET_MS = 5 * 60 * 60 * 1000;

export interface NotificationTemplate {
  templateKey: string;
  channel: "email" | "sms";
  version: number;
  subjectTemplate: string;
  bodyTemplate: string;
  enabled: boolean;
}

export function nextDayAgendaSchedule(reference = new Date()): { agendaDate: string; scheduledAt: string } {
  const pakistanReference = new Date(reference.getTime() + PAKISTAN_OFFSET_MS);
  const pakistanToday = pakistanReference.toISOString().slice(0, 10);
  const agendaDate = new Date(pakistanReference.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const scheduledAt = new Date(`${pakistanToday}T19:00:00+05:00`).toISOString();
  return { agendaDate, scheduledAt };
}

export function renderNotificationTemplate(
  template: NotificationTemplate,
  payload: Record<string, unknown>,
): { subject: string; body: string } {
  const serializedPayload = JSON.stringify(payload, null, 2);
  const interpolate = (value: string) => value.replaceAll("{{payload}}", serializedPayload);
  return {
    subject: interpolate(template.subjectTemplate),
    body: interpolate(template.bodyTemplate),
  };
}
