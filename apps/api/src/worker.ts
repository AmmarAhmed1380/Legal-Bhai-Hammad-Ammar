import { createEmailProvider, createSmsProvider, createWhatsAppProvider, dispatchClientSmsWithWhatsAppFailover } from "./lib/providers.js";
import { createRuntimeProductStore } from "./lib/runtime-product-store.js";
import { envFlag, isProduction, validateProductionEnvironment } from "./lib/config.js";
import { COURT_SOURCE_DEFINITIONS, fetchCourtCauseList } from "./lib/court-sources.js";
import { renderNotificationTemplate } from "./lib/notification-schedule.js";
import { captureError, initializeErrorReporting, registerProcessErrorHandlers } from "./lib/telemetry.js";
import { runScheduledDatabaseBackup } from "./lib/database-backup.js";
import { LahoreHighCourtScraper } from "./services/scrapers/lhc-scraper.js";
import { DistrictCourtScraper } from "./services/scrapers/district-scraper.js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

initializeErrorReporting();
registerProcessErrorHandlers();
validateProductionEnvironment();
const store = createRuntimeProductStore();
const smsProvider = createSmsProvider();
const whatsAppProvider = createWhatsAppProvider();
const emailProvider = createEmailProvider();
let notificationCycleRunning = false;
let courtCycleRunning = false;
let backupCycleRunning = false;

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
          ? await dispatchClientSmsWithWhatsAppFailover({
              templateKey: job.templateKey,
              phone: recipient.phone ?? "",
              body: rendered.body,
              whatsAppProvider,
              smsProvider,
            })
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

async function runBackupCycleSafely(): Promise<void> {
  if (backupCycleRunning || envFlag("BACKUP_ENABLED", true) === false) {
    return;
  }
  backupCycleRunning = true;
  try {
    const result = await runScheduledDatabaseBackup();
    if (result.ran) {
      console.error("[backup] nightly archive completed", { storageKey: result.storageKey });
    }
  } catch (error) {
    captureError(error);
    console.error("Database backup cycle failed", error);
  } finally {
    backupCycleRunning = false;
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

let lastScrapeDatePakistan = "";

function isOneAmPakistanTime(): boolean {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };
  const formatter = new Intl.DateTimeFormat("en-US", options);
  return formatter.format(new Date()) === "01:00";
}

function getPakistanDate(): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };
  const formatter = new Intl.DateTimeFormat("en-CA", options);
  return formatter.format(new Date());
}

async function runDailyScraperCycleSafely(): Promise<void> {
  if (!isOneAmPakistanTime()) {
    return;
  }
  const today = getPakistanDate();
  if (lastScrapeDatePakistan === today) {
    return;
  }
  lastScrapeDatePakistan = today;

  console.log(`[Worker] Executing daily 1:00 AM PKT scraper cycle for ${today}...`);
  try {
    const lhcScraper = new LahoreHighCourtScraper();
    const lhcRows = await lhcScraper.fetchCauseList(today);
    console.log(`[Worker] LHC Scraper parsed ${lhcRows?.length ?? 0} rows`);

    const districtScraper = new DistrictCourtScraper();
    const activeCaseNumbers = ["W.P. 2076/2019", "C.R. 456/2021"];
    const districtMatches = await districtScraper.scrapeAndMatchCases(today, activeCaseNumbers);
    console.log(`[Worker] District Scraper matched ${districtMatches?.length ?? 0} cases`);
  } catch (error) {
    captureError(error);
    console.error("Daily scraper cycle failed:", error);
  }
}

const notificationInterval = setInterval(() => void runNotificationCycleSafely(), 60_000);
const courtInterval = setInterval(
  () => void runCourtSourceCycleSafely(),
  Number(process.env.COURT_SYNC_INTERVAL_MINUTES ?? 1) * 60_000,
);
const backupInterval = setInterval(
  () => void runBackupCycleSafely(),
  Number(process.env.BACKUP_CHECK_INTERVAL_MINUTES ?? 60) * 60_000,
);
const scraperInterval = setInterval(() => void runDailyScraperCycleSafely(), 60_000);

void runNotificationCycleSafely();
void runCourtSourceCycleSafely();
void runBackupCycleSafely();
void runDailyScraperCycleSafely();

async function shutdown(): Promise<void> {
  clearInterval(notificationInterval);
  clearInterval(courtInterval);
  clearInterval(backupInterval);
  clearInterval(scraperInterval);
  await store.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
