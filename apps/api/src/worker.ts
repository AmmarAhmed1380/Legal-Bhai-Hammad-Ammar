import { createEmailProvider, createSmsProvider } from "./lib/providers.js";
import { createRuntimeProductStore } from "./lib/runtime-product-store.js";
import { envFlag, isProduction, validateProductionEnvironment } from "./lib/config.js";
import { COURT_SOURCE_DEFINITIONS, fetchCourtCauseList } from "./lib/court-sources.js";
import { renderNotificationTemplate } from "./lib/notification-schedule.js";
import { captureError, initializeErrorReporting } from "./lib/telemetry.js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

initializeErrorReporting();
validateProductionEnvironment();
const store = createRuntimeProductStore();
const smsProvider = createSmsProvider();
const emailProvider = createEmailProvider();
let notificationCycleRunning = false;
let courtCycleRunning = false;

async function runCycle(): Promise<void> {
  await store.schedulePilotNotifications();
  for (const job of await store.claimDueNotificationJobs()) {
    try {
      const recipient = await store.getNotificationRecipient(job);
      if (!recipient) {
        throw new Error("Notification recipient not found");
      }
      const template = await store.getNotificationTemplate(job);
      if (!template?.enabled) {
        throw new Error(`Notification template ${job.templateKey}/${job.channel}/v${job.templateVersion} is unavailable`);
      }
      const rendered = renderNotificationTemplate(template, job.payload);
      const delivery =
        job.channel === "sms"
          ? await smsProvider.send(recipient.phone ?? "", rendered.body)
          : await emailProvider.send(recipient.email ?? "", rendered.subject, `<pre>${rendered.body}</pre>`);
      await store.recordNotificationAttempt(job.id, { providerId: delivery.providerId, error: null });
    } catch (error) {
      await store.recordNotificationAttempt(job.id, { providerId: null, error: error instanceof Error ? error.message : "Unknown provider failure" });
    }
  }
}

async function runCourtSourceCycle(): Promise<void> {
  if (process.env.COURT_SYNC_ENABLED === "false") {
    return;
  }
  for (const source of COURT_SOURCE_DEFINITIONS) {
    for (const listType of source.supportedListTypes) {
      try {
        const causeList = await fetchCourtCauseList(source.id, listType);
        await store.ingestCourtCauseList(source.id, causeList.rows, causeList.listDate, listType);
      } catch (error) {
        captureError(error);
        await store.recordCourtIngestionFailure(source.id, listType, error instanceof Error ? error.message : "Unknown court source provider failure");
      }
    }
  }
}

async function runNotificationCycleSafely(): Promise<void> {
  if (notificationCycleRunning) {
    return;
  }
  notificationCycleRunning = true;
  try {
    await runCycle();
  } catch (error) {
    captureError(error);
    console.error("Notification worker cycle failed", error);
  } finally {
    notificationCycleRunning = false;
  }
}

async function runCourtSourceCycleSafely(): Promise<void> {
  if (courtCycleRunning) {
    return;
  }
  courtCycleRunning = true;
  try {
    await runCourtSourceCycle();
  } catch (error) {
    captureError(error);
    console.error("Court source worker cycle failed", error);
  } finally {
    courtCycleRunning = false;
  }
}

const notificationInterval = setInterval(() => void runNotificationCycleSafely(), 60_000);
const courtInterval = setInterval(
  () => void runCourtSourceCycleSafely(),
  Number(process.env.COURT_SYNC_INTERVAL_MINUTES ?? 1) * 60_000,
);
void runNotificationCycleSafely();
void runCourtSourceCycleSafely();

async function shutdown(): Promise<void> {
  clearInterval(notificationInterval);
  clearInterval(courtInterval);
  await store.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
