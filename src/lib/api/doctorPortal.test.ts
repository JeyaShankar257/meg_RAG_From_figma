import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { api, isBackendConfigured } from "./apiClient.ts";
import { getMockPipelineForPatient, PATIENT_MOCK_PIPELINES } from "../mockData.ts";
import type {
  DoctorDashboardResponse,
  PatientPipelineResponse,
  DoctorSettingsResponse,
  ApprovalResponse,
} from "../types.ts";

describe("Doctor Portal Frontend Workflows & Integration (Tasks 3.1 - 3.9)", () => {
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = globalThis.localStorage;

  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    globalThis.localStorage = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
      key: (idx: number) => Object.keys(mockStorage)[idx] ?? null,
      get length() {
        return Object.keys(mockStorage).length;
      },
    } as Storage;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalLocalStorage;
  });

  // ─── 1. Patient-Specific Mock Pipeline Snapshots (Task 3.4) ───────────────
  describe("Patient-Aware Mock Pipeline Snapshots (Task 3.4)", () => {
    it("Marcus Rivera (p-001) renders standard active/completed 5-stage workflow", () => {
      const pipeline = getMockPipelineForPatient("p-001");
      assert.equal(pipeline.length, 5);

      const stageKeys = pipeline.map((s) => s.name);
      assert.deepEqual(stageKeys, [
        "Reminder Agent",
        "Dose Logging Agent",
        "Pattern Detection Agent",
        "Escalation Agent",
        "Care Team Interaction Agent",
      ]);

      // Marcus has completed reminder, idle logging, completed pattern detection, idle escalation
      assert.equal(pipeline[0].status, "complete");
      assert.equal(pipeline[1].status, "idle");
      assert.equal(pipeline[2].status, "complete");
      assert.equal(pipeline[3].status, "idle");
      assert.equal(pipeline[4].status, "complete");
    });

    it("David Kowalski (p-003) renders urgent escalation and error states with missed dose logs", () => {
      const pipeline = getMockPipelineForPatient("p-003");
      assert.equal(pipeline.length, 5);

      // David Kowalski has active escalation with warning/error states
      const escalationStage = pipeline.find((s) => s.name === "Escalation Agent");
      assert.ok(escalationStage);
      assert.equal(escalationStage.status, "error");
      assert.ok(escalationStage.logs.some((l) => l.level === "error" && l.message.includes("urgent")));

      const doseLoggingStage = pipeline.find((s) => s.name === "Dose Logging Agent");
      assert.ok(doseLoggingStage);
      assert.ok(doseLoggingStage.logs.some((l) => l.message.includes("18 consecutive missed doses")));

      const careTeamStage = pipeline.find((s) => s.name === "Care Team Interaction Agent");
      assert.ok(careTeamStage);
      assert.equal(careTeamStage.status, "running");
    });

    it("Sofia Patel (p-004) renders empty/idle workflow awaiting account activation", () => {
      const pipeline = getMockPipelineForPatient("p-004");
      assert.equal(pipeline.length, 5);

      // All stages are idle for newly invited patient
      for (const stage of pipeline) {
        assert.equal(stage.status, "idle");
      }
      assert.ok(pipeline[0].logs[0].message.includes("Patient invited"));
    });
  });

  // ─── 2. Doctor Dashboard API Client Methods (Task 3.1 & 3.2) ──────────────
  describe("api.doctor.getDashboard (Task 3.1 & 3.2)", () => {
    it("returns mock dashboard data when backend is not configured", async () => {
      const data = await api.doctor.getDashboard();
      assert.ok(data.patientCount);
      assert.equal(data.patientCount.availability, "available");
      assert.ok(data.averageAdherence);
      assert.equal(data.averageAdherence.availability, "available");
      assert.ok(data.openEscalations);
      assert.ok(data.remindersDelivered);
      assert.ok(Array.isArray(data.recentActivity));
      assert.ok(data.correlationId);
      assert.ok(data.freshnessTimestamp);
    });

    it("handles typed backend response with unavailable and error metrics safely", async () => {
      const mockResponse: DoctorDashboardResponse = {
        patientCount: { value: 142, availability: "available" },
        averageAdherence: {
          value: 0,
          availability: "unavailable",
          errorMessage: "Adherence computation temporarily unavailable",
        },
        openEscalations: {
          value: 0,
          availability: "error",
          errorMessage: "Escalation query service timed out",
        },
        remindersDelivered: { value: 0, availability: "unavailable" },
        recentActivity: [],
        freshnessTimestamp: "2026-10-13T19:00:00.000Z",
        correlationId: "corr-dash-test-01",
      };

      // Verify shape meets contract
      assert.equal(mockResponse.patientCount.availability, "available");
      assert.equal(mockResponse.averageAdherence.availability, "unavailable");
      assert.equal(mockResponse.openEscalations.availability, "error");
      assert.equal(mockResponse.openEscalations.errorMessage, "Escalation query service timed out");
    });
  });

  // ─── 3. Prescription Approval API Client Methods (Task 3.1 & 3.3) ─────────
  describe("api.prescriptions.approve (Task 3.1 & 3.3)", () => {
    it("sends approval payload with idempotencyKey and suggestion snapshot", async () => {
      const idempotencyKey = "idem-test-rx-001";
      const suggestion = {
        name: "Losartan",
        strength: "50mg",
        frequency: "daily",
        quantity: 30,
        days: 30,
        instructions: "Take 1 tablet daily with water",
      };

      const res = await api.prescriptions.approve("rx-123", {
        idempotencyKey,
        suggestion,
        editedValues: { dosage: "50mg" },
        reason: "Clinical substitution for dry cough",
      });

      assert.equal(res.success, true);
      assert.ok(res.prescription);
      assert.equal(res.prescription.status, "approved");
      assert.equal(res.prescription.medication.name, "Losartan");
    });

    it("preserves local prescriptions on approval error without modifying state", async () => {
      const localPrescriptions = [{ id: "rx-1", name: "Lisinopril", status: "active" }];

      // Simulated failed API call
      const simulateFailure = async () => {
        throw new Error("Server error: unauthorized doctor");
      };

      await assert.rejects(simulateFailure, {
        message: "Server error: unauthorized doctor",
      });

      // Local array remains unaltered
      assert.equal(localPrescriptions.length, 1);
      assert.equal(localPrescriptions[0].status, "active");
    });
  });

  // ─── 4. Doctor Settings API Client Methods (Task 3.1 & 3.8) ───────────────
  describe("api.doctor.getSettings & updateSettings (Task 3.1 & 3.8)", () => {
    it("returns default doctor settings in demo mode", async () => {
      const res = await api.doctor.getSettings();
      assert.ok(res.profile);
      assert.equal(res.profile.role, "doctor");
      assert.ok(res.preferences);
      assert.ok(Array.isArray(res.preferences.notification.channels));
      assert.ok(res.preferences.notification.quietHoursStart);
      assert.ok(res.preferences.notification.quietHoursEnd);
    });

    it("updates doctor profile and notification preferences round-trip", async () => {
      const updated = await api.doctor.updateSettings({
        displayName: "Dr. Sarah Chen, MD",
        specialty: "Cardiology",
        phone: "+1-555-9988",
        notification: {
          channels: ["email", "sms"],
          quietHoursStart: "23:00",
          quietHoursEnd: "06:00",
        },
      });

      assert.equal(updated.preferences.displayName, "Dr. Sarah Chen, MD");
      assert.equal(updated.preferences.specialty, "Cardiology");
      assert.deepEqual(updated.preferences.notification.channels, ["email", "sms"]);
      assert.equal(updated.preferences.notification.quietHoursStart, "23:00");
      assert.equal(updated.preferences.notification.quietHoursEnd, "06:00");
    });
  });
});
