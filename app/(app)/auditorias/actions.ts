// app/(app)/auditorias/actions.ts
"use server"

import { sql } from "@vercel/postgres"
import { getContext } from "../lib/context"

export type AuditHubCampaignRow = {
  id: string
  name: string
  framework: string | null
  status: "draft" | "active" | "closed"
  progress_pct: number
  owner_name: string | null
  period_start: string | null
  period_end: string | null
}

export type AuditHubData = {
  kpis: {
    active_count: number
    active_delta_month: number
    avg_progress_pct: number
    awaiting_validation: number
    overdue_count: number
  }
  campaigns: AuditHubCampaignRow[]
}

export async function fetchAuditHub(): Promise<AuditHubData> {
  const ctx = await getContext()

  // ✅ KPIs (mantém robusto: se não existir coluna/tabela, cai em defaults)
  let activeCount = 0
  let avgProgress = 0
  let awaitingValidation = 0
  let overdueCount = 0
  let activeDeltaMonth = 0

  // campanhas (audit_campaigns)
  const campaignsRes = await sql<{
    id: string
    name: string
    framework: string | null
    status: string
    period_start: string | null
    period_end: string | null
  }>`
    SELECT
      id::text AS id,
      name,
      framework::text AS framework,
      status::text AS status,
      period_start::text AS period_start,
      period_end::text AS period_end
    FROM audit_campaigns
    WHERE tenant_id = ${ctx.tenantId}
    ORDER BY created_at DESC
    LIMIT 200;
  `

  const campaigns: AuditHubCampaignRow[] = campaignsRes.rows.map((r) => {
    const status = (r.status as any) as "draft" | "active" | "closed"
    // progress_pct hoje está como placeholder (até você plugar regra real por controle/evidência)
    const progress = status === "closed" ? 100 : status === "active" ? 75 : 15

    return {
      id: r.id,
      name: r.name,
      framework: r.framework,
      status,
      progress_pct: progress,
      owner_name: null,
      period_start: r.period_start,
      period_end: r.period_end,
    }
  })

  activeCount = campaigns.filter((c) => c.status === "active").length
  avgProgress = campaigns.length
    ? campaigns.reduce((acc, c) => acc + (c.progress_pct ?? 0), 0) / campaigns.length
    : 0

  // awaiting_validation / overdue_count (placeholder — depende do seu workflow real)
  // Se você já usa kpi_executions + revisões, dá pra trocar por counts reais.
  awaitingValidation = 0
  overdueCount = 0
  activeDeltaMonth = 0

  return {
    kpis: {
      active_count: activeCount,
      active_delta_month: activeDeltaMonth,
      avg_progress_pct: avgProgress,
      awaiting_validation: awaitingValidation,
      overdue_count: overdueCount,
    },
    campaigns,
  }
}