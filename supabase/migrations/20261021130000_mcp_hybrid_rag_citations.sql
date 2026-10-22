-- Extend ai_citations with MCP hybrid RAG provenance columns
alter table if exists ai_citations
  add column if not exists source_tier text not null default 'patient_record' check (source_tier in ('patient_record', 'external_mcp')),
  add column if not exists url text;
