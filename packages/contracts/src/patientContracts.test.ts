import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    patientDoseSchedulesResponseSchema,
    patientAdherenceSummarySchema,
    patientTransparencyResponseSchema,
} from "./index.js";
import doseSchedulesFixture from "../fixtures/patient-dose-schedules.valid.json" with { type: "json" };
import adherenceFixture from "../fixtures/patient-adherence.valid.json" with { type: "json" };
import transparencyFixture from "../fixtures/patient-transparency.valid.json" with { type: "json" };

describe("Patient Portal Contract Fixtures (Task 1.2)", () => {
    it("validates patient-dose-schedules.valid.json against schema", () => {
        const result = patientDoseSchedulesResponseSchema.safeParse(doseSchedulesFixture);
        assert.ok(result.success, "patient-dose-schedules.valid.json must match schema");
    });

    it("validates patient-adherence.valid.json against schema", () => {
        const result = patientAdherenceSummarySchema.safeParse(adherenceFixture);
        assert.ok(result.success, "patient-adherence.valid.json must match schema");
    });

    it("validates patient-transparency.valid.json against schema", () => {
        const result = patientTransparencyResponseSchema.safeParse(transparencyFixture);
        assert.ok(result.success, "patient-transparency.valid.json must match schema");
    });
});
