-- Migration: 0007_rag_vector_search.sql
-- Enables pgvector extension and creates knowledge sources, knowledge chunks,
-- RAG queries, RAG results, and document-indexing jobs.
-- Defines vector similarity search functions and Row Level Security (RLS) policies.
-- Additive only — never modifies or drops existing columns once deployed.

-- ─── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists vector;

-- ─── RAG Enums ────────────────────────────────────────────────────────────────
do $$ begin
  create type rag_source_type as enum (
    'guideline',
    'research',
    'patient_visit',
    'patient_report',
    'medication_reference'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type knowledge_source_status as enum ('draft', 'reviewed', 'archived');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type rag_query_status as enum ('pending', 'running', 'completed', 'error');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type document_indexing_status as enum ('uploaded', 'indexing', 'searchable', 'failed');
exception when duplicate_object then null;
end $$;

-- ─── Knowledge Sources ────────────────────────────────────────────────────────
create table if not exists knowledge_sources (
  id                uuid primary key default gen_random_uuid(),
  source_type       rag_source_type not null,
  title             text not null,
  publisher         text,
  publication_date  text,
  url               text,
  workspace_id      uuid not null references workspaces(id),
  patient_id        text references patients(id), -- NULL for workspace/global clinical knowledge; non-null for patient-scoped sources
  report_id         uuid references patient_reports(id) on delete set null,
  version           text not null default '1.0',
  status            knowledge_source_status not null default 'draft',
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_knowledge_sources_workspace
  on knowledge_sources(workspace_id);

create index if not exists idx_knowledge_sources_patient
  on knowledge_sources(patient_id) where patient_id is not null;

create index if not exists idx_knowledge_sources_status
  on knowledge_sources(status);

-- ─── Knowledge Chunks ─────────────────────────────────────────────────────────
create table if not exists knowledge_chunks (
  id                  uuid primary key default gen_random_uuid(),
  source_id           uuid not null references knowledge_sources(id) on delete cascade,
  workspace_id        uuid not null references workspaces(id),
  patient_id          text references patients(id), -- denormalized for efficient RLS and retrieval filtering
  chunk_index         integer not null default 0,
  chunk_text          text not null,
  embedding           vector(768) not null,
  embedding_model     text not null default 'text-embedding-004',
  embedding_version   text not null default '1',
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  constraint uq_knowledge_chunk_source_index unique (source_id, chunk_index)
);

create index if not exists idx_knowledge_chunks_source
  on knowledge_chunks(source_id);

create index if not exists idx_knowledge_chunks_workspace
  on knowledge_chunks(workspace_id);

create index if not exists idx_knowledge_chunks_patient
  on knowledge_chunks(patient_id);

create index if not exists idx_knowledge_chunks_model_version
  on knowledge_chunks(embedding_model, embedding_version);

-- HNSW index for fast similarity search using cosine distance
create index if not exists idx_knowledge_chunks_embedding
  on knowledge_chunks using hnsw (embedding vector_cosine_ops);

-- ─── RAG Queries ──────────────────────────────────────────────────────────────
create table if not exists rag_queries (
  id                      uuid primary key default gen_random_uuid(),
  workspace_id            uuid not null references workspaces(id),
  patient_id              text not null references patients(id),
  requested_by_profile_id uuid not null references profiles(id),
  analysis_id             uuid references ai_analyses(id) on delete set null,
  symptoms                text not null,
  question                text,
  query_text              text not null,
  query_embedding         vector(768),
  embedding_model         text not null default 'text-embedding-004',
  embedding_version       text not null default '1',
  top_k                   integer not null default 6,
  similarity_threshold    numeric(4,3) not null default 0.650,
  status                  rag_query_status not null default 'pending',
  correlation_id          text not null,
  created_at              timestamptz not null default now(),
  completed_at            timestamptz,
  last_error              text
);

create index if not exists idx_rag_queries_patient
  on rag_queries(patient_id, created_at desc);

create index if not exists idx_rag_queries_analysis
  on rag_queries(analysis_id) where analysis_id is not null;

create index if not exists idx_rag_queries_workspace
  on rag_queries(workspace_id);

-- ─── RAG Results ──────────────────────────────────────────────────────────────
create table if not exists rag_results (
  id                uuid primary key default gen_random_uuid(),
  query_id          uuid not null references rag_queries(id) on delete cascade,
  chunk_id          uuid not null references knowledge_chunks(id) on delete cascade,
  source_id         uuid not null references knowledge_sources(id) on delete cascade,
  rank              integer not null,
  similarity_score  numeric(6,5) not null,
  excerpt           text not null,
  created_at        timestamptz not null default now(),
  constraint uq_rag_results_query_rank unique (query_id, rank)
);

create index if not exists idx_rag_results_query
  on rag_results(query_id);

-- ─── Document Indexing Jobs ───────────────────────────────────────────────────
create table if not exists document_indexing_jobs (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces(id),
  patient_id        text not null references patients(id),
  report_id         uuid not null references patient_reports(id) on delete cascade,
  source_id         uuid references knowledge_sources(id) on delete set null,
  status            document_indexing_status not null default 'uploaded',
  attempts          integer not null default 0,
  max_attempts      integer not null default 3,
  idempotency_key   text not null unique,
  correlation_id    text not null,
  last_error        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  completed_at      timestamptz
);

create index if not exists idx_document_indexing_jobs_report
  on document_indexing_jobs(report_id);

create index if not exists idx_document_indexing_jobs_patient
  on document_indexing_jobs(patient_id);

-- Track indexing status directly on patient_reports
alter table patient_reports
  add column if not exists indexing_status document_indexing_status not null default 'uploaded';

-- ─── Vector Similarity Search Function ─────────────────────────────────────────
create or replace function match_knowledge_chunks(
  p_workspace_id        uuid,
  p_patient_id          text,
  p_query_embedding     vector(768),
  p_embedding_model     text default 'text-embedding-004',
  p_embedding_version   text default '1',
  p_match_threshold     numeric default 0.650,
  p_match_count         integer default 6
)
returns table (
  chunk_id          uuid,
  source_id         uuid,
  title             text,
  source_type       rag_source_type,
  publisher         text,
  publication_date  text,
  chunk_text        text,
  similarity_score  numeric,
  chunk_index       integer,
  metadata          jsonb
)
language plpgsql
security definer
stable
as $$
begin
  return query
  select
    kc.id as chunk_id,
    ks.id as source_id,
    ks.title,
    ks.source_type,
    ks.publisher,
    ks.publication_date,
    kc.chunk_text,
    round((1 - (kc.embedding <=> p_query_embedding))::numeric, 5) as similarity_score,
    kc.chunk_index,
    kc.metadata
  from knowledge_chunks kc
  join knowledge_sources ks on ks.id = kc.source_id
  where kc.workspace_id = p_workspace_id
    and kc.embedding_model = p_embedding_model
    and kc.embedding_version = p_embedding_version
    -- Scope: Either reviewed global clinical knowledge OR authorized patient records
    and (
      (ks.patient_id is null and ks.status = 'reviewed')
      or
      (
        ks.patient_id = p_patient_id
        -- Ensure patient reports respect sharing and consent flags
        and (
          ks.report_id is null
          or exists (
            select 1 from patient_reports pr
            join consent_records cr on cr.patient_id = pr.patient_id
            where pr.id = ks.report_id
              and pr.shared_with_care_team = true
              and cr.allow_ai_analysis = true
          )
        )
      )
    )
    and (1 - (kc.embedding <=> p_query_embedding)) >= p_match_threshold
  order by
    kc.embedding <=> p_query_embedding asc,
    kc.chunk_index asc
  limit p_match_count;
end;
$$;

-- ─── Enable Row Level Security (RLS) ──────────────────────────────────────────
alter table knowledge_sources enable row level security;
alter table knowledge_chunks enable row level security;
alter table rag_queries enable row level security;
alter table rag_results enable row level security;
alter table document_indexing_jobs enable row level security;

-- ─── RLS Policies: knowledge_sources ──────────────────────────────────────────
create policy "knowledge_sources_select"
  on knowledge_sources for select
  using (
    -- Shared clinical sources must be reviewed and match user workspace
    (
      patient_id is null
      and status = 'reviewed'
      and workspace_id = get_current_user_workspace()
    )
    or
    -- Patient-specific sources: doctor assigned, patient self, or care grant
    (
      patient_id is not null
      and workspace_id = get_current_user_workspace()
      and (
        is_assigned_doctor(patient_id)
        or is_patient_self(patient_id)
        or has_active_care_grant(patient_id, 'all')
        or get_current_user_role() = 'admin'
      )
    )
  );

create policy "knowledge_sources_insert"
  on knowledge_sources for insert
  with check (
    workspace_id = get_current_user_workspace()
    and (
      -- Only admin can insert global clinical knowledge
      (patient_id is null and get_current_user_role() = 'admin')
      or
      -- Doctors or admins can insert patient-scoped sources
      (patient_id is not null and (is_assigned_doctor(patient_id) or get_current_user_role() = 'admin'))
    )
  );

create policy "knowledge_sources_update"
  on knowledge_sources for update
  using (
    workspace_id = get_current_user_workspace()
    and (
      (patient_id is null and get_current_user_role() = 'admin')
      or
      (patient_id is not null and (is_assigned_doctor(patient_id) or get_current_user_role() = 'admin'))
    )
  );

-- ─── RLS Policies: knowledge_chunks ───────────────────────────────────────────
create policy "knowledge_chunks_select"
  on knowledge_chunks for select
  using (
    (
      patient_id is null
      and workspace_id = get_current_user_workspace()
      and exists (
        select 1 from knowledge_sources ks
        where ks.id = source_id and ks.status = 'reviewed'
      )
    )
    or
    (
      patient_id is not null
      and workspace_id = get_current_user_workspace()
      and (
        is_assigned_doctor(patient_id)
        or is_patient_self(patient_id)
        or has_active_care_grant(patient_id, 'all')
        or get_current_user_role() = 'admin'
      )
    )
  );

create policy "knowledge_chunks_insert"
  on knowledge_chunks for insert
  with check (
    workspace_id = get_current_user_workspace()
    and (
      (patient_id is null and get_current_user_role() = 'admin')
      or
      (patient_id is not null and (is_assigned_doctor(patient_id) or get_current_user_role() = 'admin'))
    )
  );

-- ─── RLS Policies: rag_queries ────────────────────────────────────────────────
create policy "rag_queries_select"
  on rag_queries for select
  using (
    workspace_id = get_current_user_workspace()
    and (
      is_assigned_doctor(patient_id)
      or is_patient_self(patient_id)
      or get_current_user_role() = 'admin'
    )
  );

create policy "rag_queries_insert"
  on rag_queries for insert
  with check (
    workspace_id = get_current_user_workspace()
    and (
      is_assigned_doctor(patient_id)
      or get_current_user_role() = 'admin'
    )
  );

-- ─── RLS Policies: rag_results ────────────────────────────────────────────────
create policy "rag_results_select"
  on rag_results for select
  using (
    exists (
      select 1 from rag_queries rq
      where rq.id = query_id
        and rq.workspace_id = get_current_user_workspace()
        and (
          is_assigned_doctor(rq.patient_id)
          or is_patient_self(rq.patient_id)
          or get_current_user_role() = 'admin'
        )
    )
  );

create policy "rag_results_insert"
  on rag_results for insert
  with check (
    exists (
      select 1 from rag_queries rq
      where rq.id = query_id
        and rq.workspace_id = get_current_user_workspace()
        and (
          is_assigned_doctor(rq.patient_id)
          or get_current_user_role() = 'admin'
        )
    )
  );

-- ─── RLS Policies: document_indexing_jobs ─────────────────────────────────────
create policy "document_indexing_jobs_select"
  on document_indexing_jobs for select
  using (
    workspace_id = get_current_user_workspace()
    and (
      is_assigned_doctor(patient_id)
      or is_patient_self(patient_id)
      or get_current_user_role() = 'admin'
    )
  );

create policy "document_indexing_jobs_insert"
  on document_indexing_jobs for insert
  with check (
    workspace_id = get_current_user_workspace()
    and (
      is_assigned_doctor(patient_id)
      or is_patient_self(patient_id)
      or get_current_user_role() = 'admin'
    )
  );

create policy "document_indexing_jobs_update"
  on document_indexing_jobs for update
  using (
    workspace_id = get_current_user_workspace()
    and (
      is_assigned_doctor(patient_id)
      or get_current_user_role() = 'admin'
    )
  );
