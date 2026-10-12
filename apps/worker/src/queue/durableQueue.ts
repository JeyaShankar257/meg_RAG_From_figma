import type { SupabaseClient } from "@supabase/supabase-js";

export interface DurableJob {
    id: string;
    type: string;
    payload: Record<string, any>;
    status: "pending" | "claimed" | "completed" | "failed" | "dead_letter";
    idempotency_key: string;
    correlation_id: string;
    attempts: number;
    max_attempts: number;
    next_run_at: string;
    claimed_at?: string | null;
    completed_at?: string | null;
    last_error?: string | null;
}

export class DurableQueue {
    constructor(private supabase: SupabaseClient) {}

    /**
     * Atomically claims eligible pending jobs whose next_run_at <= now()
     */
    async claimJobs(limit = 5): Promise<DurableJob[]> {
        const now = new Date().toISOString();

        // Select pending jobs due for execution
        const { data: candidates, error: selectErr } = await this.supabase
            .from("jobs")
            .select("*")
            .eq("status", "pending")
            .lte("next_run_at", now)
            .order("next_run_at", { ascending: true })
            .limit(limit);

        if (selectErr || !candidates || candidates.length === 0) {
            return [];
        }

        const claimed: DurableJob[] = [];

        // Claim each candidate atomically
        for (const candidate of candidates) {
            const { data: updated, error: updateErr } = await this.supabase
                .from("jobs")
                .update({
                    status: "claimed",
                    claimed_at: now,
                })
                .eq("id", candidate.id)
                .eq("status", "pending")
                .select()
                .maybeSingle();

            if (!updateErr && updated) {
                claimed.push(updated as DurableJob);
            }
        }

        return claimed;
    }

    /**
     * Marks a claimed job as successfully completed
     */
    async completeJob(jobId: string): Promise<void> {
        const now = new Date().toISOString();
        await this.supabase
            .from("jobs")
            .update({
                status: "completed",
                completed_at: now,
            })
            .eq("id", jobId);
    }

    /**
     * Handles job failure with exponential backoff retry or terminal dead-letter transition
     */
    async failJob(
        job: DurableJob,
        errorMessage: string,
        customRetrySeconds?: number,
    ): Promise<{ terminal: boolean; nextRunAt?: string }> {
        const nextAttempts = job.attempts + 1;
        const now = new Date();

        if (nextAttempts >= job.max_attempts) {
            // Terminal failure -> Move to dead_letter queue
            await this.supabase
                .from("jobs")
                .update({
                    status: "dead_letter",
                    attempts: nextAttempts,
                    last_error: errorMessage,
                })
                .eq("id", job.id);

            return { terminal: true };
        }

        // Retryable failure -> Exponential backoff (e.g. 10s, 20s, 40s, 80s...)
        const delaySeconds = customRetrySeconds ?? Math.min(Math.pow(2, nextAttempts) * 5, 3600);
        const nextRun = new Date(now.getTime() + delaySeconds * 1000).toISOString();

        await this.supabase
            .from("jobs")
            .update({
                status: "pending",
                attempts: nextAttempts,
                next_run_at: nextRun,
                last_error: errorMessage,
                claimed_at: null,
            })
            .eq("id", job.id);

        return { terminal: false, nextRunAt: nextRun };
    }
}
