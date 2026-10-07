# Proposal

## Why

The backend changes currently have partial scaffolding but no verified, runnable
runtime across the TypeScript API, background worker, and Python agent service.
The existing `setup-backend-infrastructure` and `add-rag-ai-assistant` changes
depend on this foundation for reliable configuration, health checks, shared
contracts, correlation IDs, and safe observability.

## What Changes

- Establish a runnable backend workspace foundation for the API, worker, and
  Python agent service without changing the existing Vite entrypoint.
- Standardize server-only environment validation, including Gemini configuration,
  and provide actionable startup failures without exposing secret values.
- Add consistent health and readiness boundaries for process status and required
  service dependencies.
- Define a shared, versioned TypeScript/Python job and result contract with
  validation and compatibility checks.
- Use LangChain for Gemini/provider, prompt, retriever, and structured-output
  integrations inside the Python agent service.
- Use LangGraph for explicit, stateful agent workflow orchestration while
  keeping the initial workflow deterministic and single-agent.
- Provide the initial worker entrypoint and lifecycle boundary without enabling
  clinical processing before authorization and durable job handling exist.
- Harden correlation-ID propagation and structured logging so metadata cannot
  overwrite reserved fields or expose secret-like values.
- Add workspace-level verification commands for formatting, typechecking, and
  backend service checks.

## Capabilities

### New Capabilities

- `backend-runtime-foundation`: Runnable, consistently configured backend
  services with health/readiness reporting, versioned internal contracts,
  correlation-aware safe logging, and verification boundaries.

### Modified Capabilities

- None.

## Impact

- **Frontend:** No behavior or entrypoint changes; the existing Vite application
  remains independently runnable.
- **Backend:** `apps/api`, `apps/worker`, and `apps/agents` gain aligned startup,
  health, configuration, and verification behavior. The Python agent service
  gains LangChain/LangGraph integration behind the versioned job/result
  boundary.
- **Data:** No clinical schema changes are introduced by this foundation.
- **Security:** Secrets remain server-side; health responses and logs remain
  non-sensitive; clinical mutations remain unavailable to the worker or agent
  until later authorized changes.
- **Compatibility:** The foundation must integrate with the in-flight
  `setup-backend-infrastructure` and `add-rag-ai-assistant` changes without
  replacing their domain or RAG requirements. CrewAI is intentionally not part
  of this foundation; multi-agent orchestration remains deferred until the
  product has a clear need for independently coordinated clinical roles.
- **Dependencies:** Shared TypeScript packages, Python Pydantic models, and
  repository scripts become explicit compatibility boundaries for later work.
  Python dependencies include LangChain, LangGraph, and the selected Gemini
  integration, with framework usage isolated to `apps/agents`.
