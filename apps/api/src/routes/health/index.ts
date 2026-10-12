import { Hono } from "hono";
import { getConfig } from "../../config.js";

const healthRouter = new Hono();

/**
 * GET /health
 *
 * Returns non-sensitive service status.
 * Does NOT expose config values, secrets, DB connection strings, or version details.
 */
healthRouter.get("/", (c) => {
    let demoMode = true;
    try {
        const config = getConfig();
        demoMode = config.demoMode;
    } catch {
        // fallback if config not yet initialized
    }

    return c.json({
        status: "healthy",
        service: "mednova-api",
        contractVersion: "1.0",
        demoMode,
        timestamp: new Date().toISOString(),
    });
});

healthRouter.get("/live", (c) =>
    c.json({
        status: "ok",
        service: "mednova-api",
        timestamp: new Date().toISOString(),
    }),
);

healthRouter.get("/ready", (c) => {
    let ready = true;
    let mode = "demo";
    try {
        const config = getConfig();
        ready = config.demoMode || Boolean(config.agentsServiceUrl);
        mode = config.demoMode ? "demo" : "configured";
    } catch {
        // fallback
    }

    return c.json(
        {
            status: ready ? "ok" : "unavailable",
            service: "mednova-api",
            mode,
            timestamp: new Date().toISOString(),
        },
        ready ? 200 : 503,
    );
});

export { healthRouter };
