# Design

## Context

The repository has a Hono API with correlation middleware, a partially defined
worker package, a FastAPI agent service with a stub dispatch route, shared
TypeScript packages, and a first clinical database migration. The services do
not yet have a verified common lifecycle or a workspace-level backend
verification path. See `proposal.md` for the motivation.

The foundation must support the two in-flight changes without making the
worker or agent a privileged clinical mutation path:

```text
                    +----------------------+
                    |  Workspace commands  |
                    |  format/typecheck    |
                    |  service verification |
                    +----------+-----------+
                               |
             +-----------------+-----------------+
             v                 v                 v
      +-------------+   +-------------+   +-------------+
      | TypeScript  |   | TypeScript  |   | Python      |
      | API         |   | Worker      |   | Agent       |
      | auth later  |   | jobs later  |   | LangGraph   |
      +------+------+   +------+------+   +------+------+
             |                 |                 |
             +-----------------+-----------------+
                               |
                 versioned contracts + correlation ID
                               |
                    +----------v-----------+
                    | LangGraph workflow   |
                    | validate -> prompt   |
                    | -> provider ->       |
                    | structured result    |
                    +----------+-----------+
                               |
                    +----------v-----------+
                    | safe logs / health   |
                    | no secrets, no       |
                    | clinical mutations   |
                    +----------------------+
```

## Goals / Non-Goals

**Goals:**

- Make each backend service startable and independently verifiable.
- Establish one documented configuration and lifecycle vocabulary for startup,
  health, readiness, and shutdown boundaries.
- Keep TypeScript/Python job and result payloads versioned and reject
  incompatible contracts explicitly.
- Propagate validated correlation IDs across API requests and internal service
  calls.
- Make structured logs safe by construction and health responses
  non-sensitive.
- Establish LangChain/LangGraph as an isolated Python agent boundary for
  deterministic, schema-validated advisory workflows.
- Preserve the current demo-mode stubs while making their boundaries explicit.

**Non-Goals:**

- Implement Supabase authentication, RLS policies, or protected clinical API
  routes.
- Implement durable job claiming, retries, scheduling, or worker processing.
- Implement production Gemini retrieval, report indexing, or clinical RAG
  behavior; this foundation only establishes the provider and workflow
  boundary with deterministic test/demo behavior.
- Move frontend mock data to the backend.
- Treat process health as proof that clinical dependencies are authorized or
  ready for production traffic.

## Decisions

### 1. Keep service configuration server-local, but align its contract

Each service will retain a local configuration module because the API, worker,
and Python process have different required variables. Their shared vocabulary
will cover service identity, environment mode, dependency URLs, contract
version, and safe startup errors. Secret values will never be included in
exceptions, logs, health responses, or readiness payloads.

**Alternative considered:** one shared runtime configuration package. This
would couple Python and TypeScript packaging and encourage services to accept
variables they do not need, so it is deferred.

### 2. Separate liveness from readiness

Liveness answers whether the process can serve requests. Readiness answers
whether the service has initialized the dependencies required for the
currently enabled mode. During this foundation phase, readiness checks are
non-mutating and may report unavailable dependencies; later database and
worker changes will add authenticated dependency probes.

The API and agent health contracts will expose only stable status fields,
service identity, timestamp, and correlation ID where applicable. They will
not expose URLs, model names that encode secrets, stack traces, or
configuration values.

**Alternative considered:** a single detailed health endpoint. That makes
orchestration and security semantics ambiguous, so liveness and readiness are
kept distinct.

### 3. Use explicit contract versions with fail-closed validation

The TypeScript contract package remains the source for the version constant and
canonical payload shape. The Python service will validate the same version and
field requirements using Pydantic models. Unsupported versions return an
explicit compatibility error rather than being coerced into the stub workflow.

Contract fixtures will be treated as cross-language compatibility examples.
They will not contain patient secrets or production credentials.

**Alternative considered:** untyped JSON with best-effort field access. This
would make drift invisible and is unsafe for clinical-adjacent recommendations.

### 4. Create a worker lifecycle boundary before a job processor

The worker will gain an entrypoint that validates configuration, reports
startup state, and exposes a clear lifecycle hook for future polling and job
claiming. It will not claim or mutate clinical jobs in this change. The agent
service remains advisory-only and its current `needs_review` response is
explicitly a demo-mode stub.

**Alternative considered:** implement the durable queue at the same time. That
would combine runtime bootstrapping with authorization, idempotency, retries,
and database transaction design; those belong to the backend infrastructure
change.

### 5. Isolate LangChain integrations behind a LangGraph workflow

The Python agent service will use LangChain for provider, prompt, retriever,
and structured-output integrations, with LangGraph owning explicit workflow
state and transitions. The initial graph is deterministic and single-agent:

```text
received
   |
   v
validate AgentJob and authorized evidence
   |
   v
construct bounded prompt with untrusted-evidence delimiters
   |
   v
invoke provider adapter
   |
   v
validate structured output and classify result
   |
   +--> completed
   +--> needs_review
   +--> failed_retryable / failed_terminal
```

Pydantic contracts remain the transport and safety boundary around the
framework. LangChain and LangGraph must not own authentication, RLS decisions,
patient-scope authorization, durable job identity, persistence, audit events,
or prescription approval. The initial provider adapter supports a deterministic
fake implementation for tests and demo mode; production Gemini behavior
belongs to the dependent RAG change.

**Alternative considered:** CrewAI or unconstrained multi-agent collaboration.
That would introduce autonomous delegation before the project has durable
authorization and audit foundations. It remains deferred until independently
coordinated clinical roles are a demonstrated requirement.

### 6. Make logging fields reserved and correlation IDs bounded

The logger will construct reserved fields (`level`, `message`, `timestamp`)
after filtering metadata, so caller metadata cannot overwrite them. Secret-like
metadata keys remain excluded. Incoming correlation IDs will be accepted only
when they satisfy a bounded format; otherwise a new UUID is generated. The
generated or accepted ID is echoed in responses and passed to logs.

Authorization decisions and clinical actions will later emit audit events
through the database audit boundary; application logs are operational
telemetry, not a replacement for immutable audit records.

**Alternative considered:** trust arbitrary incoming IDs and rely on log
consumers for normalization. That permits unbounded log injection and makes
request tracing unreliable.

### 7. Add verification at the workspace boundary

The root workspace will provide commands that run the smallest useful checks
for shared packages, the API, the worker, and Python agent tests. Service-local
commands remain available for focused development. Verification will include
the existing frontend build/typecheck so the backend foundation cannot silently
break the current application.

## Risks / Trade-offs

- **[Risk]** Readiness checks may be mistaken for authorization or clinical
  availability. **Mitigation:** use explicit liveness/readiness semantics and
  keep protected routes disabled until auth/RLS work lands.
- **[Risk]** Configuration alignment can still drift between languages.
  **Mitigation:** maintain versioned contract fixtures and test both accepted
  and rejected versions.
- **[Risk]** More defensive logging can hide useful diagnostic metadata.
  **Mitigation:** allowlisted operational fields remain available while
  secret-like keys and reserved-field collisions are removed deterministically.
- **[Risk]** A worker entrypoint that does not process jobs may look complete.
  **Mitigation:** label it as a lifecycle stub and keep queue processing in the
  later durable-jobs task set.
- **[Risk]** Existing demo environments may not provide all production
  dependencies. **Mitigation:** preserve explicit demo-mode stubs while making
  production-only requirements fail clearly at startup.

## Migration Plan

1. Add or align service configuration and shared contract validation without
   changing existing frontend startup.
2. Add liveness/readiness responses and safe correlation-aware logging.
3. Add the worker lifecycle entrypoint and Python compatibility fixtures.
4. Add the LangChain provider adapter, LangGraph workflow boundary, and
   deterministic compatibility tests without enabling production clinical
   generation.
5. Add root verification scripts and run them alongside the existing frontend
   checks.
6. Roll back by disabling the new backend commands or reverting the foundation
   change; no clinical tables or persisted records are modified by this
   change.
7. Enable database, authorization, durable jobs, and production agent work only
   through the dependent OpenSpec changes.

## Open Questions

- The exact deployment orchestrator and signal-handling requirements can be
  selected later, provided they preserve the liveness/readiness distinction.
- The final production log sink and retention policy can be chosen later
  without changing the service contracts.
