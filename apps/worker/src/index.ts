import { initWorkerConfig, getWorkerConfig } from "./config.js";
import { lifecycleStatus } from "./lifecycle.js";

const config = initWorkerConfig();
const logger = (message: string, metadata: Record<string, unknown> = {}) => {
    console.log(
        JSON.stringify({
            level: "info",
            message,
            timestamp: new Date().toISOString(),
            service: config.serviceName,
            ...metadata,
        }),
    );
};

let shuttingDown = false;
const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger("worker_shutdown", { signal, processing: false });
    process.exit(0);
};

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

logger("worker_started", {
    ...lifecycleStatus(config.demoMode),
    pollIntervalMs: config.pollIntervalMs,
});

if (!config.demoMode) {
    logger("worker_lifecycle_only", {
        message: "Job claiming is disabled until durable job processing is enabled.",
    });
}
