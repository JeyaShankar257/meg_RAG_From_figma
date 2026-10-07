/**
 * Worker-specific environment validation.
 * Shares the same pattern as apps/api/src/config.ts.
 */

export interface WorkerEnvConfig {
    supabaseUrl: string;
    supabaseServiceRoleKey: string;
    resendApiKey: string;
    resendFromAddress: string;
    agentsServiceUrl: string;
    agentsInternalSecret: string;
    pollIntervalMs: number;
    maxConcurrentJobs: number;
    demoMode: boolean;
    serviceName: "mednova-worker";
    contractVersion: "1.0";
}

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value || value.trim() === "") {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value.trim();
}

function requireInt(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed)) {
        throw new Error(`Environment variable ${name} must be an integer, got: "${raw}"`);
    }
    return parsed;
}

export function validateWorkerEnv(): WorkerEnvConfig {
    const errors: string[] = [];
    const collect = <T>(fn: () => T, key: string): T | undefined => {
        try { return fn(); } catch (e) { errors.push(`  ✗ ${key}: ${(e as Error).message}`); return undefined; }
    };

    const supabaseUrl = collect(() => requireEnv("SUPABASE_URL"), "SUPABASE_URL");
    const supabaseServiceRoleKey = collect(() => requireEnv("SUPABASE_SERVICE_ROLE_KEY"), "SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = collect(() => requireEnv("RESEND_API_KEY"), "RESEND_API_KEY");
    const resendFromAddress = collect(() => requireEnv("RESEND_FROM_ADDRESS"), "RESEND_FROM_ADDRESS");
    const agentsServiceUrl = collect(() => requireEnv("AGENTS_SERVICE_URL"), "AGENTS_SERVICE_URL");
    const agentsInternalSecret = collect(() => requireEnv("AGENTS_INTERNAL_SECRET"), "AGENTS_INTERNAL_SECRET");

    if (errors.length > 0) {
        console.error([
            "", "═══════════════════════════════════════════════════════",
            "  MedNova Worker: startup failed — missing environment",
            "═══════════════════════════════════════════════════════",
            ...errors, "",
            "  Copy .env.example to apps/worker/.env and fill in the required values.",
            "═══════════════════════════════════════════════════════", "",
        ].join("\n"));
        process.exit(1);
    }

    return {
        supabaseUrl: supabaseUrl!,
        supabaseServiceRoleKey: supabaseServiceRoleKey!,
        resendApiKey: resendApiKey!,
        resendFromAddress: resendFromAddress!,
        agentsServiceUrl: agentsServiceUrl!,
        agentsInternalSecret: agentsInternalSecret!,
        pollIntervalMs: requireInt("WORKER_POLL_INTERVAL_MS", 5000),
        maxConcurrentJobs: requireInt("WORKER_MAX_CONCURRENT_JOBS", 5),
        demoMode: process.env["DEMO_MODE"] === "true",
        serviceName: "mednova-worker",
        contractVersion: "1.0",
    };
}

let _config: WorkerEnvConfig | null = null;

export function getWorkerConfig(): WorkerEnvConfig {
    if (!_config) throw new Error("Worker config not initialized. Call validateWorkerEnv() at startup.");
    return _config;
}

export function initWorkerConfig(): WorkerEnvConfig {
    _config = validateWorkerEnv();
    return _config;
}
