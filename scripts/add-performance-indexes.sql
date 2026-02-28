-- Performance indexes focused on multi-tenant filters and frequent list/sort patterns.
-- Safe to run multiple times.

-- =============================
-- ACTION PLANS
-- =============================
CREATE INDEX IF NOT EXISTS idx_action_plans_tenant_team_updated
  ON action_plans (tenant_id, team_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_action_plans_tenant_status_due
  ON action_plans (tenant_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_action_plans_tenant_risk
  ON action_plans (tenant_id, risk_id);

CREATE INDEX IF NOT EXISTS idx_action_plans_tenant_responsible
  ON action_plans (tenant_id, responsible_name);

-- =============================
-- CONTROLS
-- =============================
CREATE INDEX IF NOT EXISTS idx_controls_tenant_team_created
  ON controls (tenant_id, team_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_controls_tenant_framework
  ON controls (tenant_id, framework_id);

CREATE INDEX IF NOT EXISTS idx_controls_tenant_risk
  ON controls (tenant_id, risk_id);

CREATE INDEX IF NOT EXISTS idx_controls_tenant_frequency
  ON controls (tenant_id, frequency);

-- =============================
-- RISK CATALOG
-- =============================
CREATE INDEX IF NOT EXISTS idx_risk_catalog_tenant_team_code
  ON risk_catalog (tenant_id, team_id, risk_code);

CREATE INDEX IF NOT EXISTS idx_risk_catalog_tenant_classification
  ON risk_catalog (tenant_id, classification);

CREATE INDEX IF NOT EXISTS idx_risk_catalog_tenant_source
  ON risk_catalog (tenant_id, source);

CREATE INDEX IF NOT EXISTS idx_risk_catalog_tenant_natureza
  ON risk_catalog (tenant_id, natureza);

CREATE INDEX IF NOT EXISTS idx_risk_catalog_tenant_impact_likelihood
  ON risk_catalog (tenant_id, impact, likelihood);

-- =============================
-- KPI EXECUTIONS / KPIS
-- =============================
CREATE INDEX IF NOT EXISTS idx_kpi_executions_tenant_control_period_start_created
  ON kpi_executions (tenant_id, control_id, period_start DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kpi_executions_tenant_control_period_end_created
  ON kpi_executions (tenant_id, control_id, period_end DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kpi_executions_tenant_period_start
  ON kpi_executions (tenant_id, period_start);

CREATE INDEX IF NOT EXISTS idx_kpis_tenant_control
  ON kpis (tenant_id, control_id);

-- =============================
-- OPTIONAL: ILIKE acceleration (requires pg_trgm extension)
-- Keep commented if write cost is a concern or extension is unavailable.
-- =============================
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS idx_controls_name_trgm ON controls USING gin (name gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS idx_controls_code_trgm ON controls USING gin (control_code gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS idx_risk_catalog_title_trgm ON risk_catalog USING gin (title gin_trgm_ops);
