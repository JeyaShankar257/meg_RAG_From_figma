import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { initWorkerConfig, type WorkerEnvConfig } from "./config.js";
import { lifecycleStatus } from "./lifecycle.js";
import { DurableQueue, type DurableJob } from "./queue/durableQueue.js";
import {
    processGenerateDoseSchedule,
    processSendReminder,
    processAdherenceAndAiAnalysis,
} from "./jobs/processors.js";
import { Resend } from "resend";

const config: WorkerEnvConfig = initWorkerConfig();

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
let pollTimer: NodeJS.Timeout | null = null;
let isPolling = false;

const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
    logger("worker_shutdown", { signal, processing: false });
    process.exit(0);
};

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

const supabase: SupabaseClient = createClient(
    config.supabaseUrl,
    config.supabaseServiceRoleKey,
    {
        auth: { persistSession: false, autoRefreshToken: false },
    },
);

const queue = new DurableQueue(supabase);

const resendClient =
    config.resendApiKey && config.resendApiKey !== "demo-resend-key"
        ? new Resend(config.resendApiKey)
        : undefined;

/**
 * Dispatches a claimed job to its appropriate processor.
 */
async function dispatchJob(job: DurableJob) {
    switch (job.type) {
        case "send_reminder":
            return await processSendReminder(job, supabase, resendClient as any);

        case "generate_dose_schedule":
            return await processGenerateDoseSchedule(job, supabase);

        case "adherence_pattern_detection":
        case "adherence_aggregation":
            return await processAdherenceAndAiAnalysis(job, supabase);

        default:
            logger("worker_unknown_job_type", { jobId: job.id, type: job.type });
            return { success: true };
    }
}

/**
 * Poll loop execution tick.
 */
export async function pollTick() {
    if (isPolling || shuttingDown) return;
    isPolling = true;

    try {
        if (config.demoMode) {
            logger("worker_demo_poll", {
                message: "[WORKER DEMO] Job loop running (no actual sends)",
                pollIntervalMs: config.pollIntervalMs,
            });
        }

        const claimed = await queue.claimJobs(config.maxConcurrentJobs);
        if (claimed.length > 0) {
            logger("worker_jobs_claimed", { count: claimed.length });
        }

        for (const job of claimed) {
            try {
                const res = await dispatchJob(job);
                if (res.success) {
                    await queue.completeJob(job);
                    logger("worker_job_completed", { jobId: job.id, type: job.type });
                } else if (res.retryable) {
                    await queue.failJob(job, res.error || "Retryable error occurred");
                    logger("worker_job_retried", { jobId: job.id, error: res.error });
                } else {
                    await queue.failJob(job, res.error || "Terminal error occurred");
                    logger("worker_job_failed", { jobId: job.id, error: res.error });
                }
            } catch (jobErr: any) {
                await queue.failJob(job, jobErr?.message || "Unhandled job execution failure");
                logger("worker_job_exception", { jobId: job.id, error: jobErr?.message });
            }
        }
    } catch (err: any) {
        logger("worker_poll_error", { error: err?.message || err });
    } finally {
        isPolling = false;
    }
}

export function startJobLoop() {
    logger("worker_started", {
        ...lifecycleStatus(config.demoMode),
        pollIntervalMs: config.pollIntervalMs,
        processing: true,
    });

    // Run first tick immediately, then interval
    void pollTick();
    pollTimer = setInterval(() => {
        void pollTick();
    }, config.pollIntervalMs);
}

// Start continuous polling loop
startJobLoop();
