import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../lib/api/client";
import { getRagService } from "../lib/rag";
import type { RagUiError } from "../lib/rag/types";
import type { RagAnalysisRequest, RagAnalysisResponse } from "../lib/types";

const POLL_INTERVAL_MS = 600;

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timeout);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

function normalizeError(error: unknown): RagUiError {
  if (error instanceof ApiError) {
    return {
      message: error.message,
      requestId: error.requestId,
      retryable: error.retryable,
      unauthorized: error.status === 401 || error.status === 403 || error.status === 404,
    };
  }
  return {
    message: "The analysis could not be completed. Please try again.",
    retryable: true,
    unauthorized: false,
  };
}

export default function usePatientRagAnalysis(
  patientId: string,
  initialResponse: RagAnalysisResponse | null = null,
) {
  const [response, setResponse] = useState<RagAnalysisResponse | null>(initialResponse);
  const [error, setError] = useState<RagUiError | null>(null);
  const [lastInput, setLastInput] = useState<Omit<RagAnalysisRequest, "patientId"> | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);
  const previousPatientId = useRef(patientId);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  const runAnalysis = useCallback(async (
    input: Omit<RagAnalysisRequest, "patientId">,
  ) => {
    if (!input.symptoms.trim() && !input.question?.trim()) {
      setError({
        message: "Enter symptoms, observations, or a clinical question.",
        retryable: false,
        unauthorized: false,
      });
      return;
    }

    cancel();
    const controller = new AbortController();
    controllerRef.current = controller;
    const sequence = ++requestSequence.current;
    setError(null);
    setResponse(null);
    setLastInput(input);

    try {
      const service = getRagService();
      let next = await service.createAnalysis(
        { patientId, symptoms: input.symptoms.trim(), question: input.question?.trim() || undefined },
        controller.signal,
      );
      if (sequence !== requestSequence.current) return;
      setResponse(next);

      while (next.status === "pending" || next.status === "running") {
        await wait(POLL_INTERVAL_MS, controller.signal);
        next = await service.getAnalysis(next.id, controller.signal);
        if (sequence !== requestSequence.current) return;
        setResponse(next);
      }

      if (next.status === "complete") {
        const evidenceResponse = await service.getEvidence(next.id, controller.signal);
        next = {
          ...next,
          evidence: evidenceResponse.evidence,
          evidenceStatus: evidenceResponse.evidenceStatus ?? next.evidenceStatus,
        };
        if (sequence !== requestSequence.current) return;
        setResponse(next);
      }

      if (next.status === "error") {
        setError({
          message: next.error || "The analysis could not be completed.",
          requestId: next.correlationId,
          retryable: Boolean(next.retryable),
          unauthorized: false,
        });
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      if (sequence !== requestSequence.current) return;
      setError(normalizeError(caught));
    } finally {
      if (sequence === requestSequence.current) controllerRef.current = null;
    }
  }, [cancel, patientId]);

  const retry = useCallback(() => {
    if (lastInput) void runAnalysis(lastInput);
  }, [lastInput, runAnalysis]);

  const reset = useCallback(() => {
    cancel();
    requestSequence.current += 1;
    setResponse(null);
    setError(null);
  }, [cancel]);

  useEffect(() => {
    if (previousPatientId.current !== patientId) {
      previousPatientId.current = patientId;
      reset();
    }
  }, [patientId, reset]);

  useEffect(() => cancel, [cancel]);

  return {
    response,
    error,
    runAnalysis,
    retry,
    reset,
    isProcessing: response?.status === "pending" || response?.status === "running",
  };
}
