// app/(app)/action-plans/page.tsx
import Link from "next/link"
import PageContainer from "../PageContainer"
import PageHeader from "../PageHeader"
import ActionPlansFilters from "./ActionPlansFilters"
import { fetchActionPlans, fetchActionPlansFilterOptions, type ActionPlanListRow } from "./actions-list"
import { ClipboardList, Timer, AlertTriangle, BadgeCheck } from "lucide-react"
import ActionPlansTable from "./ActionPlansTable"
import NewActionPlanModal from "./NewActionPlanModal"
import { fetchOriginOptions } from "./actions-create"

function safeDate(v?: string | null) {
  if (!v) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function isOverdue(row: ActionPlanListRow) {
  const d = safeDate(row.due_date ?? null)
  if (!d) return false
  const status = (row.status || "").toLowerCase()
  if (status === "done") return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dd = new Date(d)
  dd.setHours(0, 0, 0, 0)
  return dd.getTime() < today.getTime()
}

function getQueryValue(
  searchParams: { [key: string]: string | string[] | undefined } | undefined,
  key: string
) {
  const raw = searchParams?.[key]
  const value = Array.isArray(raw) ? raw[0] : raw
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

type PageSearchParams = { [key: string]: string | string[] | undefined }

export default async function ActionPlansPage(props: {
  searchParams?: PageSearchParams | Promise<PageSearchParams | undefined>
}) {
  const searchParams = await props.searchParams

  const riskId = getQueryValue(searchParams, "risk")
  const framework = getQueryValue(searchParams, "framework")
  const responsible = getQueryValue(searchParams, "responsible")
  const status = getQueryValue(searchParams, "status")
  const priority = getQueryValue(searchParams, "priority")

  const [rows, filterOptions, originOptions] = await Promise.all([
    fetchActionPlans({ riskId, framework, responsible, status, priority }),
    fetchActionPlansFilterOptions(),
    fetchOriginOptions(),
  ])

  const total = rows.length
  const inProgress = rows.filter((r) => (r.status || "").toLowerCase() === "in_progress").length
  const overdue = rows.filter((r) => isOverdue(r)).length
  const done = rows.filter((r) => (r.status || "").toLowerCase() === "done").length

  const complianceIndex = total > 0 ? (done / total) * 100 : 0
  const complianceLabel = `${complianceIndex.toFixed(1)}%`

  // Paginação (UI placeholder)
  const page = 1
  const showingFrom = total === 0 ? 0 : 1
  const showingTo = total

  return (
    <PageContainer variant="default">
      <div className="space-y-6">
        <PageHeader
          title="Planos de Ação"
          description={
            <div className="space-y-1">
              <div className="text-sm text-text-secondary">
                Gerencie e monitore as ações de mitigação de riscos e conformidade.
              </div>

              {riskId ? (
                <div className="text-xs text-text-muted">
                  Filtrando por risco{" "}
                  <Link className="underline" href="/action-plans">
                    limpar filtro
                  </Link>
                </div>
              ) : null}
            </div>
          }
          right={
            <div className="flex items-center gap-3">
              <NewActionPlanModal originOptions={originOptions} />
            </div>
          }
        />

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-lg bg-primary/10 p-2 text-primary">
                <ClipboardList className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold text-text-muted">{total > 0 ? "Ativo" : "—"}</span>
            </div>
            <p className="text-sm font-medium text-text-secondary">Total de Planos</p>
            <p className="text-2xl font-bold text-text-primary">{total}</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-lg bg-risk-high/10 p-2 text-risk-high">
                <Timer className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold text-risk-high">Em foco</span>
            </div>
            <p className="text-sm font-medium text-text-secondary">Em Andamento</p>
            <p className="text-2xl font-bold text-text-primary">{inProgress}</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-lg bg-risk-critical/10 p-2 text-risk-critical">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold text-risk-critical">Atenção</span>
            </div>
            <p className="text-sm font-medium text-text-secondary">Planos Atrasados</p>
            <p className="text-2xl font-bold text-text-primary">{overdue}</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-lg bg-risk-low/10 p-2 text-risk-low">
                <BadgeCheck className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold text-risk-low">Performance</span>
            </div>
            <p className="text-sm font-medium text-text-secondary">Índice de Compliance</p>
            <p className="text-2xl font-bold text-text-primary">{complianceLabel}</p>
            <p className="mt-1 text-[11px] text-text-muted">Baseado em % concluído (placeholder).</p>
          </div>
        </div>

        <ActionPlansFilters
          riskId={riskId}
          framework={framework}
          responsible={responsible}
          status={status}
          priority={priority}
          options={filterOptions}
        />

        {/* Main table */}
        <ActionPlansTable
          rows={rows}
          page={page}
          total={total}
          showingFrom={showingFrom}
          showingTo={showingTo}
        />

        <div className="text-xs text-text-muted">
          Dica: se você submeter uma execução com auto_status <b>warning/out_of_target</b> ou se o GRC marcar{" "}
          <b>needs_changes/rejected</b>, deve nascer/garantir um action plan aqui. (E futuramente: planos também podem
          nascer de riscos.)
        </div>
      </div>
    </PageContainer>
  )
}
