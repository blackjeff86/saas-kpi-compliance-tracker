-- Tabelas para campanhas de auditoria
-- Execute manualmente ou use ensureAuditCampaignsTables() via createAuditCampaign

-- 1) audit_campaigns
CREATE TABLE IF NOT EXISTS audit_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  framework text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  objective text NULL,
  status text NOT NULL DEFAULT 'active',
  drive_folder_id text NULL,
  drive_folder_url text NULL,
  created_by uuid NULL,
  team_id uuid NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_campaigns_tenant ON audit_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_campaigns_team ON audit_campaigns(tenant_id, team_id);
CREATE INDEX IF NOT EXISTS idx_audit_campaigns_status ON audit_campaigns(tenant_id, status);

-- 2) audit_campaign_controls (escopo: controles da campanha)
CREATE TABLE IF NOT EXISTS audit_campaign_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  control_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, campaign_id, control_id)
);
CREATE INDEX IF NOT EXISTS idx_audit_campaign_controls_campaign ON audit_campaign_controls(campaign_id);
CREATE INDEX IF NOT EXISTS idx_audit_campaign_controls_tenant ON audit_campaign_controls(tenant_id);

-- 3) audit_request_items (lista de evidências solicitadas por campanha)
-- Cada item: control_id (controle associado), sampling_info, delivery_deadline (por item)
CREATE TABLE IF NOT EXISTS audit_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  control_id uuid NULL,
  title text NOT NULL,
  instructions text NULL,
  item_type text NOT NULL DEFAULT 'any',
  sampling_info text NULL,
  delivery_deadline date NULL,
  position int NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_request_items_campaign ON audit_request_items(campaign_id);
CREATE INDEX IF NOT EXISTS idx_audit_request_items_tenant ON audit_request_items(tenant_id);
