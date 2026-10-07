# Tasks

## 1. Shared Contracts and Configuration

- [x] 1.1 Align API, worker, and agent service configuration contracts,
  including service identity, mode, contract version, Gemini provider settings,
  and secret-safe startup errors; verify missing or malformed settings fail
  without printing secret values.
- [x] 1.2 Add cross-language AgentJob and AgentResult compatibility fixtures and
  validation checks; verify supported versions pass and unsupported versions
  fail before workflow execution.
- [x] 1.3 Add LangChain, LangGraph, Pydantic, and selected Gemini integration
  dependencies only to `apps/agents`; verify the Python environment installs
  them without changing the frontend dependency graph.

## 2. Backend Runtime and Observability

- [x] 2.1 Add the worker lifecycle entrypoint with startup, shutdown, and
  non-processing demo-mode behavior; verify the worker starts and exits
  cleanly without claiming clinical jobs.
- [x] 2.2 Add API and agent liveness/readiness responses with non-sensitive
  status contracts; verify healthy, unavailable-dependency, and demo-mode
  responses.
- [x] 2.3 Harden correlation-ID validation and propagation across API responses,
  logs, and internal service calls; verify invalid or unbounded IDs are
  replaced and valid IDs are preserved.
- [x] 2.4 Harden structured logging against secret-like metadata and reserved
  field overwrites; verify JSON production output and development output both
  retain canonical level, message, and timestamp fields.

## 3. LangChain and LangGraph Agent Boundary

- [x] 3.1 Add typed LangGraph workflow state and explicit transitions for input
  validation, evidence validation, prompt construction, provider invocation,
  output validation, and result classification; verify each terminal status is
  reachable through deterministic fixtures.
- [x] 3.2 Add a LangChain provider adapter with a deterministic fake provider
  for tests and demo mode; verify provider timeout, malformed output, and valid
  output classifications.
- [x] 3.3 Add bounded prompt construction that labels supplied patient context
  and retrieved text as untrusted evidence; verify prompt-injection fixture
  text cannot change safety policy or enable clinical mutations.
- [x] 3.4 Keep framework execution behind the FastAPI dispatch contract and
  prevent direct clinical persistence or prescription activation; verify an
  agent result remains advisory and requires doctor review.

## 4. Verification and Documentation

- [x] 4.1 Add API, worker, Python agent, and cross-language contract tests for
  lifecycle status, authorization-boundary errors, correlation IDs, logging
  redaction, and workflow result classification; verify tests run without
  production credentials.
- [x] 4.2 Add workspace verification scripts covering frontend build/typecheck,
  shared TypeScript packages, API, worker, and Python agent checks; verify the
  documented commands run from a clean checkout.
- [x] 4.3 Document the LangChain/LangGraph boundary, provider configuration,
  demo-mode behavior, deferred CrewAI decision, and security ownership;
  verify documentation matches the implemented commands and environment names.
- [x] 4.4 Run the integrated foundation verification suite and confirm no
  clinical database records or frontend behavior are changed; verify all
  foundation requirements have passing evidence before handoff to the
  dependent backend and RAG changes.
