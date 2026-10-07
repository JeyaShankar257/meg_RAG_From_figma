/**
 * Structured, safe logging utility.
 *
 * Rules:
 * - Never log secret values, tokens, keys, or passwords.
 * - Always include correlationId when available.
 * - Output JSON in production, human-readable in dev.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
    level: LogLevel;
    message: string;
    correlationId?: string;
    [key: string]: unknown;
}

const isProd = process.env["NODE_ENV"] === "production";

function log(level: LogLevel, message: string, meta: Record<string, unknown> = {}): void {
    // Strip any accidentally included secret-looking keys
    const safeKeys = ["KEY", "SECRET", "TOKEN", "PASSWORD", "CREDENTIAL", "AUTH"];
    const safeMeta = Object.fromEntries(
        Object.entries(meta).filter(
            ([k]) => !safeKeys.some((sk) => k.toUpperCase().includes(sk)),
        ),
    );

    const entry: LogEntry = {
        level,
        message,
        timestamp: new Date().toISOString(),
        ...safeMeta,
    };

    const output = isProd ? JSON.stringify(entry) : formatDev(entry);

    if (level === "error") {
        console.error(output);
    } else if (level === "warn") {
        console.warn(output);
    } else {
        console.log(output);
    }
}

function formatDev(entry: LogEntry): string {
    const { level, message, timestamp, correlationId, ...rest } = entry;
    const cid = correlationId ? ` [${correlationId.slice(0, 8)}]` : "";
    const meta = Object.keys(rest).length ? " " + JSON.stringify(rest) : "";
    return `${timestamp} ${level.toUpperCase().padEnd(5)}${cid} ${message}${meta}`;
}

export const logger = {
    debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
    info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
    warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
    error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
};
