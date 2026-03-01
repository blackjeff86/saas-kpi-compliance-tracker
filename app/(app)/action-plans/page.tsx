// app/(app)/action-plans/page.tsx
import Link from "next/link"
import PageContainer from "../PageContainer"
import PageHeader from "../PageHeader"
import ActionPlansFilters from "./ActionPlansFilters"
import { fetchActionPlansFilterOptions, fetchActionPlansPage, fetchActionPlansSummary } from "./actions-list"
import { ClipboardList, Timer, AlertTriangle, BadgeCheck } from "lucide-react"
import ActionPlansTable from "./ActionPlansTable"
import NewActionPlanModal from "./NewActionPlanModal"
import { fetchOriginOptions } from "./actions-create"

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

function clampInt(v: string | undefined, def: number, min: number, max: number) {
  const n = Number(v)
  if (!Number.isFinite(n)) return def
  return Math.max(min, Math.min(max, Math.floor(n)))
}

function buildHref(params: Record<string, string>, page: number) {
  const s = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v) s.set(k, v)
  })
  s.set("page", String(page))
  return `/action-plans?${s.toString()}`
}

export default async function ActionPlansPage(props: {
  searchParams?: PageSearchParams | Promise<PageSearchParams | undefined>
}) {
  const searchParams = await props.searchParams

  const riskId = getQueryValue(searchParams, "risk")
  const framework = getQueryValue(searchParams, "framework")
  const responsible = getQueryValue(searchParams, "responsible")
  const status = getQueryValue(searchParams, "status")
  const priority = getQueryValue(searchParams, "priority")
  const page = clampInt(getQueryValue(searchParams, "page"), 1, 1, 99999)
  const pageSize = 10
  const offset = (page - 1) * pageSize

  const [{ rows, total }, summary, filterOptions, originOptions] = await Promise.all([
    fetchActionPlansPage({ riskId, framework, responsible, status, priority, limit: pageSize, offset }),
    fetchActionPlansSummary({ riskId, framework, responsible, status, priority }),
    fetchActionPlansFilterOptions(),
    fetchOriginOptions(),
  ])

  const inProgress = summary.in_progress
  const overdue = summary.overdue
  const done = summary.done

  const complianceIndex = summary.total > 0 ? (done / summary.total) * 100 : 0
  const complianceLabel = `${complianceIndex.toFixed(1)}%`

  const showingFrom = total === 0 ? 0 : offset + 1
  const showingTo = Math.min(offset + rows.length, total)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const baseParams: Record<string, string> = {
    risk: riskId ?? "",
    framework: framework ?? "",
    responsible: responsible ?? "",
    status: status ?? "",
    priority: priority ?? "",
  }

  const prevHref = page <= 1 ? null : buildHref(baseParams, page - 1)
  const nextHref = page >= totalPages ? null : buildHref(baseParams, page + 1)

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
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm min-h-[140px] flex flex-col">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-lg bg-primary/10 p-2 text-primary">
                <ClipboardList className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold text-text-muted">{total > 0 ? "Ativo" : "—"}</span>
            </div>
            <p className="text-sm font-medium text-text-secondary">Total de Planos</p>
            <p className="text-2xl font-bold text-text-primary">{total}</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm min-h-[140px] flex flex-col">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-lg bg-risk-high/10 p-2 text-risk-high">
                <Timer className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold text-risk-high">Em foco</span>
            </div>
            <p className="text-sm font-medium text-text-secondary">Em Andamento</p>
            <p className="text-2xl font-bold text-text-primary">{inProgress}</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm min-h-[140px] flex flex-col">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-lg bg-risk-critical/10 p-2 text-risk-critical">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold text-risk-critical">Atenção</span>
            </div>
            <p className="text-sm font-medium text-text-secondary">Planos Atrasados</p>
            <p className="text-2xl font-bold text-text-primary">{overdue}</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm min-h-[140px] flex flex-col">
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
          prevHref={prevHref}
          nextHref={nextHref}
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
