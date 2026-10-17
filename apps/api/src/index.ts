import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { initConfig, getConfig } from "./config.js";
import { correlationMiddleware } from "./middleware/correlation.js";
import { healthRouter } from "./routes/health/index.js";
import { logger } from "./lib/logger.js";

// ─── 1. Validate environment at startup (exits on missing vars) ───────────────
initConfig();
const config = getConfig();

// ─── 2. Build Hono app ────────────────────────────────────────────────────────
const app = new Hono<{
    Variables: { correlationId: string };
}>();

app.use("*", cors({ origin: config.corsAllowedOrigins, credentials: true }));
app.use("*", correlationMiddleware);

import { authRouter } from "./routes/auth/index.js";
import { patientsRouter } from "./routes/patients/index.js";
import { careTeamRouter } from "./routes/careTeam/index.js";
import { handleApiError } from "./lib/errors.js";

import { webhooksRouter } from "./routes/webhooks/resend.js";
import { dosesRouter } from "./routes/doses/index.js";
import { prescriptionsRouter } from "./routes/prescriptions/index.js";
import { reportsRouter } from "./routes/reports/index.js";
import { correctionsRouter } from "./routes/corrections/index.js";
import { auditRouter } from "./routes/audit/index.js";
import { doctorRouter } from "./routes/doctor/index.js";
import { escalationsRouter } from "./routes/escalations/index.js";

// ─── 3. Routes ────────────────────────────────────────────────────────────────
app.route("/health", healthRouter);
app.route("/auth", authRouter);
app.route("/patients", patientsRouter);
app.route("/care-team", careTeamRouter);
app.route("/doses", dosesRouter);
app.route("/prescriptions", prescriptionsRouter);
app.route("/reports", reportsRouter);
app.route("/corrections", correctionsRouter);
app.route("/audit", auditRouter);
app.route("/doctor", doctorRouter);
app.route("/escalations", escalationsRouter);
app.route("/webhooks", webhooksRouter);

// 404 fallback
app.notFound((c) => {
    return c.json({ error: "not_found", message: "Resource not found" }, 404);
});

// Global error handler — safe non-clinical error responses
app.onError(handleApiError);

// ─── 4. Start server ──────────────────────────────────────────────────────────
serve({ fetch: app.fetch, port: config.apiPort }, (info) => {
    logger.info(`MedNova API started`, {
        port: info.port,
        demoMode: config.demoMode,
    });
});

export type AppType = typeof app;
