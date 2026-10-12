import { describe, it, expect, vi } from "vitest";
import { DurableQueue, type DurableJob } from "./queue/durableQueue.js";
import {
    processGenerateDoseSchedule,
    processSendReminder,
    processAdherenceAndAiAnalysis,
} from "./jobs/processors.js";

describe("Worker & Durable Queue Integration Tests (Task 4.3 - 4.6)", () => {
    // ─── 1. Durable Queue Claiming, Backoff, and Dead-Letter (Task 4.3) ────────
    describe("Durable Queue Lifecycle", () => {
        it("claims eligible pending jobs atomically", async () => {
            const mockUpdate = vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        select: vi.fn().mockReturnValue({
                            maybeSingle: vi.fn().mockResolvedValue({
                                data: { id: "job-1", status: "claimed" },
                                error: null,
                            }),
                        }),
                    }),
                }),
            });

            const mockSupabase: any = {
                from: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            lte: vi.fn().mockReturnValue({
                                order: vi.fn().mockReturnValue({
                                    limit: vi.fn().mockResolvedValue({
                                        data: [{ id: "job-1", status: "pending" }],
                                        error: null,
                                    }),
                                }),
                            }),
                        }),
                    }),
                    update: mockUpdate,
                }),
            };

            const queue = new DurableQueue(mockSupabase);
            const claimed = await queue.claimJobs(5);
            expect(claimed).toHaveLength(1);
            expect(claimed[0].status).toBe("claimed");
        });

        it("applies exponential backoff on transient failure", async () => {
            const updateSpy = vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
            });

            const mockSupabase: any = {
                from: vi.fn().mockReturnValue({ update: updateSpy }),
            };

            const queue = new DurableQueue(mockSupabase);
            const job: DurableJob = {
                id: "job-1",
                type: "send_reminder",
                payload: {},
                status: "claimed",
                idempotency_key: "rem-1",
                correlation_id: "corr-1",
                attempts: 1,
                max_attempts: 5,
                next_run_at: new Date().toISOString(),
            };

            const result = await queue.failJob(job, "Network timeout connecting to email provider");
            expect(result.terminal).toBe(false);
            expect(result.nextRunAt).toBeDefined();

            // Verify update was called with status 'pending' and incremented attempts
            expect(updateSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: "pending",
                    attempts: 2,
                    last_error: "Network timeout connecting to email provider",
                }),
            );
        });

        it("transitions job to dead_letter on reaching max attempts", async () => {
            const updateSpy = vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
            });

            const mockSupabase: any = {
                from: vi.fn().mockReturnValue({ update: updateSpy }),
            };

            const queue = new DurableQueue(mockSupabase);
            const job: DurableJob = {
                id: "job-term",
                type: "send_reminder",
                payload: {},
                status: "claimed",
                idempotency_key: "rem-term",
                correlation_id: "corr-term",
                attempts: 4,
                max_attempts: 5,
                next_run_at: new Date().toISOString(),
            };

            const result = await queue.failJob(job, "Final provider rejection");
            expect(result.terminal).toBe(true);

            expect(updateSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: "dead_letter",
                    attempts: 5,
                    last_error: "Final provider rejection",
                }),
            );
        });
    });

    // ─── 2. Prescription-to-Schedule Flow & Idempotency (Task 4.1 & 4.6) ──────
    describe("Prescription-to-Schedule Processor", () => {
        it("generates 30 daily dose schedules and prevents duplicate creation", async () => {
            const insertSpy = vi.fn().mockResolvedValue({ error: null });

            let existingCount = 0;
            const mockSupabase: any = {
                from: (table: string) => {
                    if (table === "dose_schedules") {
                        return {
                            select: () => ({
                                eq: () => Promise.resolve({ data: existingCount > 0 ? [{ id: "ds-1" }] : [] }),
                            }),
                            insert: insertSpy,
                        };
                    }
                    if (table === "prescriptions") {
                        return {
                            select: () => ({
                                eq: () => ({
                                    single: () => Promise.resolve({ data: { id: "rx-1", status: "approved" }, error: null }),
                                }),
                            }),
                        };
                    }
                    return {};
                },
            };

            const job: DurableJob = {
                id: "job-rx",
                type: "generate_dose_schedule",
                payload: { prescriptionId: "rx-1", patientId: "p-001" },
                status: "claimed",
                idempotency_key: "gen-rx-1",
                correlation_id: "corr-rx",
                attempts: 0,
                max_attempts: 5,
                next_run_at: new Date().toISOString(),
            };

            // First run: schedules generated
            const run1 = await processGenerateDoseSchedule(job, mockSupabase);
            expect(run1.success).toBe(true);
            expect(insertSpy).toHaveBeenCalledTimes(1);

            // Verify 30 rows generated
            const insertedRows = insertSpy.mock.calls[0][0];
            expect(insertedRows).toHaveLength(30);

            // Second run: idempotency avoids duplicates
            existingCount = 30;
            const run2 = await processGenerateDoseSchedule(job, mockSupabase);
            expect(run2.success).toBe(true);
            expect(insertSpy).toHaveBeenCalledTimes(1); // Not called again
        });
    });

    // ─── 3. Reminder Delivery & Quiet Hours (Task 4.4 & 4.6) ──────────────────
    describe("Reminder Processor", () => {
        it("respects quiet hours and defers reminder delivery", async () => {
            const mockSupabase: any = {
                from: (table: string) => {
                    if (table === "notification_preferences") {
                        return {
                            select: () => ({
                                eq: () => ({
                                    eq: () => ({
                                        maybeSingle: () =>
                                            Promise.resolve({
                                                data: {
                                                    patient_id: "p-001",
                                                    channel: "email",
                                                    enabled: true,
                                                    quiet_hours_start: "00:00",
                                                    quiet_hours_end: "23:59", // covers current hour
                                                },
                                            }),
                                    }),
                                }),
                            }),
                        };
                    }
                    return {};
                },
            };

            const job: DurableJob = {
                id: "job-quiet",
                type: "send_reminder",
                payload: { patientId: "p-001", scheduleId: "ds-1" },
                status: "claimed",
                idempotency_key: "rem-quiet",
                correlation_id: "corr-quiet",
                attempts: 0,
                max_attempts: 5,
                next_run_at: new Date().toISOString(),
            };

            const res = await processSendReminder(job, mockSupabase);
            expect(res.success).toBe(true);
            expect(res.deferredUntil).toBeDefined();
        });

        it("dispatches reminder and records sent status with provider message ID", async () => {
            const insertSpy = vi.fn().mockResolvedValue({ error: null });
            const mockSupabase: any = {
                from: (table: string) => {
                    if (table === "notification_preferences") {
                        return {
                            select: () => ({
                                eq: () => ({
                                    eq: () => ({
                                        maybeSingle: () =>
                                            Promise.resolve({
                                                data: { enabled: true, quiet_hours_start: null, quiet_hours_end: null },
                                            }),
                                    }),
                                }),
                            }),
                        };
                    }
                    if (table === "notifications") {
                        return { insert: insertSpy };
                    }
                    return {};
                },
            };

            const job: DurableJob = {
                id: "job-active",
                type: "send_reminder",
                payload: { patientId: "p-001", scheduleId: "ds-1", email: "patient@mednova.demo" },
                status: "claimed",
                idempotency_key: "rem-active",
                correlation_id: "corr-active",
                attempts: 0,
                max_attempts: 5,
                next_run_at: new Date().toISOString(),
            };

            const res = await processSendReminder(job, mockSupabase);
            expect(res.success).toBe(true);
            expect(insertSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    patient_id: "p-001",
                    status: "sent",
                    provider_message_id: expect.any(String),
                }),
            );
        });
    });

    // ─── 4. Adherence Aggregation, AI Dispatch, Escalations (Task 4.5 & 4.6) ──
    describe("Adherence & AI Escalation Workflow", () => {
        it("detects adherence drop, runs agent workflow, and creates care-team escalation", async () => {
            const escalationSpy = vi.fn().mockResolvedValue({ error: null });
            const analysisSpy = vi.fn().mockReturnValue({
                select: () => ({
                    single: () => Promise.resolve({ data: { id: "analysis-99" } }),
                }),
            });

            // 10 logs total, only 2 taken -> 20% adherence (triggers analysis)
            const mockLogs = [
                { status: "taken", logged_at: "2026-09-01" },
                { status: "taken", logged_at: "2026-09-02" },
                { status: "missed", logged_at: "2026-09-03" },
                { status: "missed", logged_at: "2026-09-04" },
                { status: "missed", logged_at: "2026-09-05" },
                { status: "skipped", logged_at: "2026-09-06" },
                { status: "missed", logged_at: "2026-09-07" },
                { status: "missed", logged_at: "2026-09-08" },
                { status: "missed", logged_at: "2026-09-09" },
                { status: "missed", logged_at: "2026-09-10" },
            ];

            const mockSupabase: any = {
                from: (table: string) => {
                    if (table === "dose_logs") {
                        return {
                            select: () => ({
                                eq: () => ({
                                    order: () => ({
                                        limit: () => Promise.resolve({ data: mockLogs }),
                                    }),
                                }),
                            }),
                        };
                    }
                    if (table === "ai_analyses") {
                        return { insert: analysisSpy };
                    }
                    if (table === "escalations") {
                        return { insert: escalationSpy };
                    }
                    return {};
                },
            };

            const job: DurableJob = {
                id: "job-ai-adh",
                type: "adherence_aggregation",
                payload: { patientId: "p-003", workspaceId: "ws-1" },
                status: "claimed",
                idempotency_key: "ai-adh-p3",
                correlation_id: "corr-adh",
                attempts: 0,
                max_attempts: 5,
                next_run_at: new Date().toISOString(),
            };

            const res = await processAdherenceAndAiAnalysis(job, mockSupabase);
            expect(res.success).toBe(true);

            // Escalation created for care team review
            expect(escalationSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    patient_id: "p-003",
                    status: "open",
                    severity: "high", // Adherence < 50%
                }),
            );
        });

        it("handles agent retryable failure and triggers worker retry", async () => {
            const mockSupabase: any = {
                from: () => ({
                    select: () => ({
                        eq: () => ({
                            order: () => ({
                                limit: () => Promise.resolve({ data: [{ status: "missed" }] }),
                            }),
                        }),
                    }),
                }),
            };

            const job: DurableJob = {
                id: "job-ai-fail",
                type: "adherence_aggregation",
                payload: { patientId: "p-003" },
                status: "claimed",
                idempotency_key: "ai-retry",
                correlation_id: "corr-ai",
                attempts: 1,
                max_attempts: 5,
                next_run_at: new Date().toISOString(),
            };

            const retryableRunner = async () => ({
                jobId: "job-ai-fail",
                contractVersion: "1.0" as const,
                status: "failed_retryable" as const,
                modelVersion: "gemini-2.0-flash-001",
                promptVersion: "1.0",
                requiresDoctorReview: true,
                errorMessage: "Temporary LLM rate limit",
                completedAt: new Date().toISOString(),
            });

            const res = await processAdherenceAndAiAnalysis(job, mockSupabase, retryableRunner);
            expect(res.success).toBe(false);
            expect(res.retryable).toBe(true);
            expect(res.error).toContain("Temporary LLM rate limit");
        });
    });
});
