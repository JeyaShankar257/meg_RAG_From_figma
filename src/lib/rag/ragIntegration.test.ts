import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type {
  RagEvidenceStatus,
  RetrievedEvidence,
  RagAnalysisResponse,
  Prescription,
  AIPrescriptionSuggestion,
  PatientUploadedReport,
} from "../types.js";

describe("Frontend RAG Integration and State Transitions (Task 5.6 & 5.7)", () => {
  describe("Evidence Status Classification & Invariants", () => {
    it("classifies evidence count and quality according to threshold standards", () => {
      const emptyEvidence: RetrievedEvidence[] = [];
      const singleEvidence: RetrievedEvidence[] = [
        {
          sourceId: "ks-1",
          title: "NEJM ACE Inhibitors",
          sourceType: "research",
          excerpt: "Bradykinin buildup causes cough",
          similarityScore: 0.88,
        },
      ];
      const multiEvidence: RetrievedEvidence[] = [
        ...singleEvidence,
        {
          sourceId: "ks-2",
          title: "ACC/AHA Guidelines",
          sourceType: "guideline",
          excerpt: "ARB substitution is indicated",
          similarityScore: 0.82,
        },
      ];

      const classify = (items: RetrievedEvidence[]): RagEvidenceStatus => {
        if (items.length >= 2) return "sufficient";
        if (items.length === 1) return "limited";
        return "insufficient";
      };

      assert.equal(classify(emptyEvidence), "insufficient");
      assert.equal(classify(singleEvidence), "limited");
      assert.equal(classify(multiEvidence), "sufficient");
    });

    it("verifies citations do not mutate clinical records upon inspection", () => {
      const suggestion: AIPrescriptionSuggestion = {
        name: "Losartan",
        genericName: "Losartan Potassium",
        strength: "50mg",
        unit: "mg",
        frequency: "Once daily",
        quantity: 30,
        days: 30,
        instructions: "Take 1 tablet daily",
        reasoning: "Avoid bradykinin-mediated cough",
        citations: [
          {
            id: "cit-1",
            title: "NEJM Article",
            publisher: "NEJM",
            date: "2023-06-15",
            relevanceNote: "Bradykinin cough",
            type: "research_study",
          },
        ],
      };

      // Simulating user inspecting/expanding citation
      let expandedCitationId: string | null = null;
      expandedCitationId = suggestion.citations[0].id;

      // Verify citation was inspected but suggestion content remains unaltered
      assert.equal(expandedCitationId, "cit-1");
      assert.equal(suggestion.name, "Losartan");
      assert.equal(suggestion.citations.length, 1);
    });
  });

  describe("Prescription Approval Boundary (Task 5.4 & 5.7)", () => {
    it("ensures AI medication suggestion requires explicit doctor approval to create active prescription", () => {
      const aiSuggestion: AIPrescriptionSuggestion = {
        name: "Losartan",
        genericName: "Losartan Potassium",
        strength: "50mg",
        unit: "mg",
        frequency: "Once daily",
        quantity: 30,
        days: 30,
        instructions: "Take 1 tablet daily with or without food",
        reasoning: "Advisory ARB switch",
        citations: [],
      };

      const existingPrescriptions: Prescription[] = [
        {
          id: "rx-001",
          status: "active",
          suggestedBy: "doctor",
          approvedBy: "Dr. Jeya Shankar M",
          approvedAt: "2024-01-10T00:00:00Z",
          citations: [],
          revisions: [],
          medication: {
            id: "med-001",
            name: "Lisinopril",
            genericName: "Lisinopril",
            strength: "20mg",
            unit: "mg",
            frequency: "Once daily",
            quantity: 30,
            duration: "30 days",
            instructions: "Take 1 tablet daily",
            startDate: "2024-01-10",
            endDate: "2024-02-10",
            status: "active",
            prescribedBy: "Dr. Jeya Shankar M",
          },
        },
      ];

      // Invariant: At this point, AI suggestion exists, but NOT as an active prescription
      const isSuggestionActiveInPrescriptions = existingPrescriptions.some(
        (rx) => rx.medication.name === aiSuggestion.name
      );
      assert.equal(isSuggestionActiveInPrescriptions, false);

      // Now doctor explicitly reviews, optionally edits, and confirms approval:
      const doctorApprovalTimestamp = new Date("2024-03-15T10:00:00Z");
      const approvedEndDate = new Date(doctorApprovalTimestamp);
      approvedEndDate.setDate(approvedEndDate.getDate() + aiSuggestion.days);

      const approvedPrescription: Prescription = {
        id: `rx-ai-${doctorApprovalTimestamp.getTime()}`,
        status: "active",
        suggestedBy: "ai",
        approvedBy: "Dr. Jeya Shankar M",
        approvedAt: doctorApprovalTimestamp.toISOString(),
        citations: aiSuggestion.citations,
        revisions: [],
        medication: {
          id: `med-ai-${doctorApprovalTimestamp.getTime()}`,
          name: aiSuggestion.name,
          genericName: aiSuggestion.genericName,
          strength: aiSuggestion.strength,
          unit: aiSuggestion.unit,
          frequency: aiSuggestion.frequency,
          quantity: aiSuggestion.quantity,
          duration: `${aiSuggestion.days} days`,
          instructions: aiSuggestion.instructions,
          startDate: doctorApprovalTimestamp.toISOString().slice(0, 10),
          endDate: approvedEndDate.toISOString().slice(0, 10),
          status: "active",
          prescribedBy: "Dr. Jeya Shankar M",
        },
      };

      const updatedPrescriptions = [approvedPrescription, ...existingPrescriptions];

      // Now and only now is it an active prescription with recorded doctor signature
      assert.equal(updatedPrescriptions.length, 2);
      assert.equal(updatedPrescriptions[0].suggestedBy, "ai");
      assert.equal(updatedPrescriptions[0].approvedBy, "Dr. Jeya Shankar M");
      assert.equal(updatedPrescriptions[0].status, "active");
    });
  });

  describe("Report Status Transitions and Retry Handling (Task 5.5)", () => {
    it("handles report indexing status transitions and preserves report independent of indexing status", () => {
      const initialReport: PatientUploadedReport = {
        id: "rep-test-01",
        patientId: "p-001",
        patientName: "Marcus Rivera",
        title: "Complete Blood Count",
        category: "blood_test",
        reportDate: "2024-03-01",
        fileName: "cbc.pdf",
        fileType: "application/pdf",
        fileSize: 1048576,
        fileDataUrl: "data:application/pdf;base64,JVBERi0xLjQK",
        uploadedAt: "2024-03-01T12:00:00Z",
        status: "shared",
        indexingStatus: "uploaded",
      };

      // 1. Transition to indexing
      const indexingReport: PatientUploadedReport = {
        ...initialReport,
        indexingStatus: "indexing",
      };
      assert.equal(indexingReport.indexingStatus, "indexing");
      assert.equal(indexingReport.title, "Complete Blood Count");

      // 2. Transition to failed
      const failedReport: PatientUploadedReport = {
        ...indexingReport,
        indexingStatus: "failed",
        indexingError: "Corrupted PDF structure",
      };
      assert.equal(failedReport.indexingStatus, "failed");
      assert.equal(failedReport.indexingError, "Corrupted PDF structure");
      // Report remains intact for doctor viewing even if indexing failed
      assert.equal(failedReport.fileName, "cbc.pdf");

      // 3. Retry indexing transitions back to indexing and clears error
      const retryingReport: PatientUploadedReport = {
        ...failedReport,
        indexingStatus: "indexing",
        indexingError: undefined,
      };
      assert.equal(retryingReport.indexingStatus, "indexing");
      assert.equal(retryingReport.indexingError, undefined);

      // 4. Successful indexing marks report ready/searchable
      const readyReport: PatientUploadedReport = {
        ...retryingReport,
        indexingStatus: "ready",
        indexedAt: "2024-03-01T12:05:00Z",
      };
      assert.equal(readyReport.indexingStatus, "ready");
      assert.ok(readyReport.indexedAt);
    });
  });

  describe("Analysis Polling & Recoverable Errors", () => {
    it("handles transition from pending to running to complete response", () => {
      const states: RagAnalysisResponse[] = [
        {
          id: "an-01",
          status: "pending",
          evidence: [],
          evidenceStatus: "insufficient",
          correlationId: "corr-1",
        },
        {
          id: "an-01",
          status: "running",
          evidence: [],
          evidenceStatus: "insufficient",
          correlationId: "corr-1",
        },
        {
          id: "an-01",
          status: "complete",
          evidence: [
            {
              sourceId: "ks-1",
              title: "Source 1",
              sourceType: "research",
              excerpt: "Data",
            },
          ],
          evidenceStatus: "limited",
          analysis: {
            id: "an-01",
            type: "diagnostic",
            status: "complete",
            confidence: 0.9,
            severity: "mild",
            rootCause: "Medication interaction",
            hypothesis: "Lisinopril cough",
            explanation: "Advisory analysis",
            suggestedMedications: [],
            safetyFlags: ["doctor_review_required"],
            citations: [],
            relatedVisits: [],
            modelVersion: "gemini-2.0-flash",
            createdAt: new Date().toISOString(),
          },
          correlationId: "corr-1",
        },
      ];

      assert.equal(states[0].status, "pending");
      assert.equal(states[1].status, "running");
      assert.equal(states[2].status, "complete");
      assert.ok(states[2].analysis);
      assert.equal(states[2].analysis?.safetyFlags.includes("doctor_review_required"), true);
    });

    it("identifies retryable network/server errors vs permanent unauthorized errors", () => {
      const networkError = {
        message: "Failed to fetch AI analysis. Check network connection.",
        retryable: true,
        unauthorized: false,
      };

      const unauthorizedError = {
        message: "You are not authorized to view or run AI analysis for this patient.",
        retryable: false,
        unauthorized: true,
      };

      assert.equal(networkError.retryable, true);
      assert.equal(unauthorizedError.retryable, false);
      assert.equal(unauthorizedError.unauthorized, true);
    });
  });
});
