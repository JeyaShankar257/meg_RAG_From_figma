import type { SupabaseClient } from "@supabase/supabase-js";
import type { PipelineStageKey, PipelineStageStatus, PipelineLogLevel } from "@mednova/types";
import { resolveStageKey } from "@mednova/contracts";

export interface StageProjectionUpdateParams {
    supabase: SupabaseClient;
    jobId: string;
    jobType?: string;
    pipelineRunId?: string | null;
    pipelineStageId?: string | null;
    stageKey?: PipelineStageKey;
    event: "claimed" | "retry" | "completed" | "dead_letter";
    attempt: number;
    correlationId?: string;
    errorMessage?: string;
    logMessage?: string;
}

/**
 * Terminal statuses that cannot be overwritten by earlier/stale job events.
 */
const TERMINAL_STAGE_STATUSES: ReadonlySet<PipelineStageStatus> = new Set([
    "complete",
    "error",
]);

/**
 * Updates a patient pipeline stage projection based on worker job lifecycle events (Task 2.5).
 * Enforces stale update prevention, attempts monotonicity, and logs appending.
 */
export async function updatePipelineStageProjection(
    params: StageProjectionUpdateParams,
): Promise<{ updated: boolean; currentStatus?: PipelineStageStatus }> {
    const {
        supabase,
        jobId,
        jobType,
        pipelineRunId,
        pipelineStageId,
        event,
        attempt,
        correlationId,
        errorMessage,
        logMessage,
    } = params;

    // Resolve stage ID or run + stageKey
    let targetStageId = pipelineStageId;
    let resolvedStageKey = params.stageKey;

    if (!resolvedStageKey && jobType) {
        resolvedStageKey = resolveStageKey(jobType);
    }

    if (!targetStageId && pipelineRunId && resolvedStageKey) {
        const { data: foundStage } = await supabase
            .from("pipeline_stages")
            .select("id")
            .eq("pipeline_run_id", pipelineRunId)
            .eq("stage_key", resolvedStageKey)
            .maybeSingle();

        if (foundStage) {
            targetStageId = foundStage.id;
        }
    }

    if (!targetStageId) {
        // No pipeline stage attached to this job
        return { updated: false };
    }

    // 1. Fetch current stage state
    const { data: currentStage, error: fetchErr } = await supabase
        .from("pipeline_stages")
        .select("id, pipeline_run_id, stage_key, status, attempt, updated_at")
        .eq("id", targetStageId)
        .single();

    if (fetchErr || !currentStage) {
        return { updated: false };
    }

    const currentStatus = currentStage.status as PipelineStageStatus;

    // 2. Prevent stale or late job events from overwriting newer terminal states (Task 2.5)
    if (TERMINAL_STAGE_STATUSES.has(currentStatus)) {
        // Stale non-terminal update (e.g. claimed or retry received late) cannot overwrite complete/error
        if (event === "claimed" || event === "retry") {
            return { updated: false, currentStatus };
        }
        // If already complete, a dead-letter from a stale duplicate attempt is ignored
        if (currentStatus === "complete" && event === "dead_letter") {
            return { updated: false, currentStatus };
        }
    }

    // 3. Determine next status and update fields
    let nextStatus: PipelineStageStatus = currentStatus;
    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = {
        updated_at: now,
        last_job_id: jobId,
        attempt: Math.max(attempt, currentStage.attempt || 0),
    };

    switch (event) {
        case "claimed":
            if (currentStatus === "idle") {
                nextStatus = "running";
                updatePayload.status = "running";
                updatePayload.started_at = now;
            }
            break;

        case "completed":
            nextStatus = "complete";
            updatePayload.status = "complete";
            updatePayload.completed_at = now;
            updatePayload.last_error = null;
            break;

        case "retry":
            if (currentStatus !== "complete") {
                nextStatus = "retrying";
                updatePayload.status = "retrying";
                updatePayload.last_error = errorMessage || "Job retry scheduled";
            }
            break;

        case "dead_letter":
            nextStatus = "error";
            updatePayload.status = "error";
            updatePayload.last_error = errorMessage || "Job exhausted max retry attempts";
            break;
    }

    // 4. Update stage row
    await supabase
        .from("pipeline_stages")
        .update(updatePayload)
        .eq("id", targetStageId);

    // 5. Append bounded diagnostic stage log
    const logLevel: PipelineLogLevel =
        event === "dead_letter" ? "error" : event === "retry" ? "warn" : "info";

    const defaultMsg =
        event === "completed"
            ? "Stage processing completed"
            : event === "claimed"
              ? "Job execution started"
              : event === "retry"
                ? `Job attempt ${attempt} failed, retrying: ${errorMessage || "transient error"}`
                : `Job failed permanently: ${errorMessage || "exhausted retries"}`;

    await supabase.from("pipeline_stage_logs").insert({
        pipeline_stage_id: targetStageId,
        job_id: jobId,
        level: logLevel,
        message: logMessage || defaultMsg,
        correlation_id: correlationId || null,
        metadata: {
            event,
            attempt,
            jobType: jobType || null,
        },
        created_at: now,
    });

    // 6. Check and update parent pipeline run status if applicable
    const runId = currentStage.pipeline_run_id || pipelineRunId;
    if (runId) {
        const { data: allStages } = await supabase
            .from("pipeline_stages")
            .select("status")
            .eq("pipeline_run_id", runId);

        if (allStages && allStages.length > 0) {
            const allComplete = allStages.every((s) => s.status === "complete");
            const hasError = allStages.some((s) => s.status === "error");

            if (allComplete) {
                await supabase
                    .from("pipeline_runs")
                    .update({ status: "completed", completed_at: now })
                    .eq("id", runId);
            } else if (hasError) {
                await supabase
                    .from("pipeline_runs")
                    .update({ status: "failed", last_error: errorMessage || "Pipeline stage failed" })
                    .eq("id", runId);
            }
        }
    }

    return { updated: true, currentStatus: nextStatus };
}
