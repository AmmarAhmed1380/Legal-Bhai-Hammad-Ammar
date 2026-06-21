import { buildServer } from "./app.js";
import { isProduction } from "./lib/config.js";
import { initializeErrorReporting, registerProcessErrorHandlers } from "./lib/telemetry.js";

initializeErrorReporting();
registerProcessErrorHandlers();
const app = buildServer();
const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? (isProduction() ? "127.0.0.1" : "0.0.0.0");

app
  .listen({ port, host })
  .then(() => {
    console.log(`Legal Bhai API listening on http://${host}:${port}`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
