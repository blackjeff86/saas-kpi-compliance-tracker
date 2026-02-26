-- Adiciona coluna area/processo na tabela controls
-- Valores típicos: Financeiro, TI, Cyber, RH, etc.

ALTER TABLE controls ADD COLUMN IF NOT EXISTS area text NULL;

-- Índice para filtros por área (opcional, melhora performance em listagens)
CREATE INDEX IF NOT EXISTS idx_controls_area ON controls(tenant_id, area);

COMMENT ON COLUMN controls.area IS 'Área ou processo do controle (ex: Financeiro, TI, Cyber, RH)';
