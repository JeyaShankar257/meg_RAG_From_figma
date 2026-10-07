# Proposal

## Why

The MedNova frontend currently depends on in-memory demo objects, browser session state, and localStorage, so authentication, patient data, dose logs, reports, prescriptions, and care-team actions do not persist or have server-side access control. A backend is needed now to make the existing doctor and patient workflows coherent across sessions while preserving clinical safety and audit boundaries.

This proposal assumes an initial fictional-data/demo deployment, but uses production-shaped authorization, audit, storage, and asynchronous workflow boundaries so the implementation does not need to be redesigned before a compliance review.

## What Changes

- Add Supabase-backed authentication, Postgres persistence, row-level security, and private object storage.
- Add a colocated TypeScript API service for protected clinical reads and writes; the browser will not directly perform privileged clinical mutations.
- Add a separate Python agent service for stateful care-team and RAG workflows; agents return structured recommendations and never perform clinical mutations directly.
- Replace frontend-only login behavior with role-gated doctor and patient sessions, sign-out, recovery, and unauthorized states.
- Persist patients, care-team assignments, consent, visits, medications, prescriptions, dose schedules, dose logs, uploaded reports, escalations, AI analyses, pipeline runs, notifications, and audit events.
- Add transactional doctor prescription approval that records revisions and queues downstream schedule and reminder work.
- Add background processing for reminders, delivery outcomes, adherence aggregation, AI pattern analysis, escalation creation, and periodic reports.
- Move patient report uploads from base64 data URLs in localStorage to signed private storage URLs and server-owned metadata.
- Add shared API/domain types, environment configuration, migrations, fictional seed data, authorization tests, and backend verification commands.
- Add versioned TypeScript/Python job and result contracts for agent workflows.

## Capabilities

### New Capabilities

- `clinical-backend`: Authenticated, role-aware persistence and protected workflows for the doctor and patient portals, including clinical records, adherence, reports, AI review, notifications, and auditability.

### Modified Capabilities

- None. The repository has no existing OpenSpec capability specifications.

## Impact

- Frontend data access in `src/lib/mockData.ts` and `src/lib/patientReports.ts` will be replaced or adapted to an API client and authenticated session state.
- Doctor and patient login, shell, settings, patient, dose, report, transparency, and care-team pages will gain loading, error, authorization, and persistence behavior.
- New `apps/api`, `apps/worker`, `apps/agents`, shared types and job/result contracts, database migrations/RLS policies, storage integration, and environment documentation will be added.
- Runtime dependencies will include Supabase client/server libraries, an HTTP API framework, schema validation, a job/worker mechanism, email delivery integration, and test tooling.
- AI and email credentials remain server-only. Real patient data is out of scope until hosting, retention, vendor agreements, and regulatory controls are reviewed.
