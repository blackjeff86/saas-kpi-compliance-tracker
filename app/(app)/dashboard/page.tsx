// app/(app)/dashboard/page.tsx
import Link from "next/link"
import PageContainer from "../PageContainer"
import PageHeader from "../PageHeader"
import SetPageTitle from "../components/SetPageTitle"
import { fetchDashboardSummary } from "./actions"
import { CheckCircle2, Clock, AlertTriangle, TrendingDown, Download } from "lucide-react"
import FiltersBar from "./FiltersBar"
import CriticalControlsTable from "./CriticalControlsTable"
import ActionPlansTable from "../action-plans/ActionPlansTable"

function cardIcon(kind: "ok" | "overdue" | "critical" | "out") {
  const base = "w-10 h-10 rounded-lg flex items-center justify-center"
  if (kind === "ok")
    return (
      <div className={`${base} bg-[rgba(6,182,212,0.12)] text-[#06B6D4]`}>
        <CheckCircle2 className="w-5 h-5" />
      </div>
    )
  if (kind === "overdue")
    return (
      <div className={`${base} bg-[rgba(245,158,11,0.16)] text-[#F59E0B]`}>
        <Clock className="w-5 h-5" />
      </div>
    )
  if (kind === "critical")
    return (
      <div className={`${base} bg-[rgba(239,68,68,0.14)] text-[#EF4444]`}>
        <AlertTriangle className="w-5 h-5" />
      </div>
    )
  return (
    <div className={`${base} bg-[rgba(6,182,212,0.12)] text-[#06B6D4]`}>
      <TrendingDown className="w-5 h-5" />
    </div>
  )
}

function clampInt(v: any, def: number, min: number, max: number) {
  const n = Number(v)
  if (!Number.isFinite(n)) return def
  return Math.max(min, Math.min(max, Math.floor(n)))
}
function pickFirst(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v
}

type PerformanceStatusRow = Awaited<ReturnType<typeof fetchDashboardSummary>>["performance_status_6m"][number]
type PerformanceStatusKey = keyof Omit<PerformanceStatusRow, "month_key" | "total">

const PERFORMANCE_STATUS_META: Array<{ key: PerformanceStatusKey; label: string; barClass: string; legendClass: string }> = [
  { key: "effective", label: "Effective", barClass: "bg-emerald-500", legendClass: "bg-emerald-500" },
  { key: "warning", label: "Warning", barClass: "bg-yellow-500", legendClass: "bg-yellow-500" },
  { key: "critical", label: "Critical", barClass: "bg-rose-500", legendClass: "bg-rose-500" },
]

function monthLabelFromKey(monthKey: string) {
  const [yy, mm] = monthKey.split("-")
  const monthIdx = Number(mm) - 1
  if (!Number.isFinite(monthIdx) || monthIdx < 0 || monthIdx > 11) return monthKey
  const short = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
  const yearShort = String(yy).slice(-2)
  return `${short[monthIdx]}/${yearShort}`
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = (await searchParams) ?? {}

  const frameworkId = (pickFirst(sp.frameworkId) ?? "").trim() || null
  const year = clampInt(pickFirst(sp.year), new Date().getFullYear(), 2000, 2100)
  const month = clampInt(pickFirst(sp.month), new Date().getMonth() + 1, 1, 12)

  const data = await fetchDashboardSummary({ frameworkId, year, month })

  const months = [
    { v: 1, l: "Jan" },
    { v: 2, l: "Fev" },
    { v: 3, l: "Mar" },
    { v: 4, l: "Abr" },
    { v: 5, l: "Mai" },
    { v: 6, l: "Jun" },
    { v: 7, l: "Jul" },
    { v: 8, l: "Ago" },
    { v: 9, l: "Set" },
    { v: 10, l: "Out" },
    { v: 11, l: "Nov" },
    { v: 12, l: "Dez" },
  ]

  const frameworkName =
    frameworkId ? data.filters.frameworks.find((f) => f.id === frameworkId)?.name ?? "Framework" : "Todos os frameworks"
  const selectedMonthKey = `${year}-${String(month).padStart(2, "0")}`
  const selectedMonthStatus =
    data.performance_status_6m.find((r) => r.month_key === selectedMonthKey) ??
    data.performance_status_6m[data.performance_status_6m.length - 1]

  const monthTotal = Math.max(0, Number(selectedMonthStatus?.total ?? 0))
  const greenCount = Math.max(0, Number(selectedMonthStatus?.effective ?? 0))
  const yellowCount = Math.max(0, Number(selectedMonthStatus?.warning ?? 0))
  const redCount = Math.max(0, Number(selectedMonthStatus?.critical ?? 0))
  const greenPct = monthTotal > 0 ? Math.round((greenCount / monthTotal) * 100) : 0
  const yellowPct = monthTotal > 0 ? Math.round((yellowCount / monthTotal) * 100) : 0
  const redPct = monthTotal > 0 ? Math.round((redCount / monthTotal) * 100) : 0

  const maxStatusCount = Math.max(
    1,
    ...data.performance_status_6m.flatMap((row) => PERFORMANCE_STATUS_META.map((s) => Number(row[s.key] ?? 0)))
  )
  const tickStep = Math.max(1, Math.ceil(maxStatusCount / 4))
  const chartMaxCount = tickStep * 4
  const chartTicks = [0, tickStep, tickStep * 2, tickStep * 3, tickStep * 4]

  const printHref = `/dashboard/print?frameworkId=${encodeURIComponent(frameworkId ?? "")}&year=${year}&month=${month}`
  const dueSoonTotal = data.action_plans_due_soon.length
  const dueSoonFrom = dueSoonTotal > 0 ? 1 : 0
  const dueSoonTo = dueSoonTotal

  return (
    <PageContainer variant="dashboard">
      <SetPageTitle title="Dashboard" />
      <div className="space-y-6">
        {/* Header + filtros + PDF */}
        <div className="flex flex-col gap-4">
          <PageHeader
            title="Dashboard"
            description="Visão geral"
            right={
              <div className="no-print flex items-center gap-2">
                <Link
                  href={printHref}
                  target="_blank"
                  className="ui-btn-primary"
                  title="Exportar PDF (abre versão de impressão)"
                >
                  <Download className="w-4 h-4" />
                  Exportar PDF
                </Link>
              </div>
            }
          />

          {/* ✅ filtros auto-aplicáveis (client) */}
          <FiltersBar
            frameworks={data.filters.frameworks}
            months={months}
            value={{
              frameworkId: frameworkId ?? "",
              month: String(month),
              year: String(year),
            }}
          />
        </div>

        {/* Cards — mesma estrutura/altura dos cards da página Revisões GRC */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="ui-card-hover rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm min-h-[140px] flex flex-col">
            <div className="mb-3 flex items-center justify-between">
              {cardIcon("ok")}
            </div>
            <p className="text-sm font-medium text-[#475569]">Green</p>
            <p className="text-2xl font-bold text-[#0F172A]">{greenPct}%</p>
            <p className="mt-1 text-xs text-[#475569]">{greenCount} de {monthTotal} controles</p>
          </div>

          <div className="ui-card-hover rounded-xl border border-yellow-200 bg-yellow-50/40 p-5 shadow-sm min-h-[140px] flex flex-col">
            <div className="mb-3 flex items-center justify-between">
              {cardIcon("overdue")}
            </div>
            <p className="text-sm font-medium text-[#475569]">Yellow</p>
            <p className="text-2xl font-bold text-[#0F172A]">{yellowPct}%</p>
            <p className="mt-1 text-xs text-[#475569]">{yellowCount} de {monthTotal} controles</p>
          </div>

          <div className="ui-card-hover rounded-xl border border-rose-200 bg-rose-50/40 p-5 shadow-sm min-h-[140px] flex flex-col">
            <div className="mb-3 flex items-center justify-between">
              {cardIcon("critical")}
            </div>
            <p className="text-sm font-medium text-[#475569]">Red</p>
            <p className="text-2xl font-bold text-[#0F172A]">{redPct}%</p>
            <p className="mt-1 text-xs text-[#475569]">{redCount} de {monthTotal} controles</p>
          </div>

          <div className="ui-card-hover rounded-xl border border-slate-200 p-5 shadow-sm min-h-[140px] flex flex-col">
            <div className="mb-3 flex items-center justify-between">
              <Clock className="w-5 h-5 text-[#64748B]" />
            </div>
            <p className="text-sm font-medium text-[#475569]">Pendências</p>
            <div className="mt-1 space-y-0.5 text-xs text-[#475569]">
              <div className="flex justify-between"><span>Pendentes Execução</span><span className="font-semibold text-[#0F172A]">{data.counts.controls_pending_execution}</span></div>
              <div className="flex justify-between"><span>Em atraso</span><span className="font-semibold text-[#DC2626]">{data.counts.controls_overdue_execution}</span></div>
              <div className="flex justify-between"><span>Não aplicável</span><span className="font-semibold text-[#0F172A]">{data.counts.controls_not_applicable}</span></div>
              <div className="flex justify-between"><span>Pendentes Revisão GRC</span><span className="font-semibold text-[#DC2626]">{data.counts.executions_pending_grc}</span></div>
            </div>
          </div>
        </div>

        {/* Desempenho 6m */}
        <div className="ui-card p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
            <div>
            <h2 className="text-[30px] leading-none font-semibold text-[#0F172A]">Desempenho de Execução</h2>
            <p className="mt-2 text-sm text-[#475569]">Comparativo mensal de controles por resultado (últimos 6 meses)</p>
            </div>
            <div className="text-xs text-[#475569]">
              <span className="font-semibold">{frameworkName}</span> • Últimos 6 meses (independente do filtro)
            </div>
          </div>

          <div className="flex flex-col h-72 w-full">
            {/* Área do gráfico: eixos e barras compartilham a mesma origem */}
            <div className="flex-1 min-h-0 flex relative pl-10">
              {/* Grid e barras */}
              <div className="flex-1 min-w-0 relative border-l border-b border-[#E2E8F0]">
                {chartTicks.map((tick) => (
                  <div
                    key={tick}
                    className="absolute left-0 right-0 border-t border-dashed border-[#E2E8F0]"
                    style={{ bottom: `${(tick / chartMaxCount) * 100}%` }}
                  />
                ))}
                <div className="absolute inset-0 flex items-end gap-3 px-1">
                  {data.performance_status_6m.map((row) => (
                    <div key={row.month_key} className="group relative flex h-full flex-1 flex-col justify-end">
                      <div className="pointer-events-none absolute left-1/2 top-2 z-20 w-36 -translate-x-1/2 rounded-md border border-[#E2E8F0] bg-white/95 p-2 text-[11px] text-[#334155] opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
                        <div className="mb-1 font-semibold text-[#0F172A]">{monthLabelFromKey(row.month_key)}</div>
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Green</span>
                          <span className="font-semibold">{row.effective}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-500" />Yellow</span>
                          <span className="font-semibold">{row.warning}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" />Red</span>
                          <span className="font-semibold">{row.critical}</span>
                        </div>
                      </div>
                      <div className="flex h-full w-full max-w-[130px] mx-auto items-end justify-center gap-2 min-h-0">
                        {PERFORMANCE_STATUS_META.map((status) => {
                          const count = Number(row[status.key] ?? 0)
                          const pct = chartMaxCount > 0 ? (count / chartMaxCount) * 100 : 0
                          const hasValue = count > 0
                          return (
                            <div
                              key={status.key}
                              className={`w-[38px] flex-shrink-0 rounded-sm ${status.barClass}`}
                              style={{
                                height: hasValue ? `${Math.min(100, pct)}%` : undefined,
                                minHeight: hasValue ? 4 : 6,
                              }}
                            />
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Eixo Y - alinhado às linhas de grade */}
              <div className="absolute left-0 top-0 bottom-0 w-10">
                {chartTicks.map((tick) => (
                  <div
                    key={tick}
                    className="absolute right-2 text-xs text-[#64748B]"
                    style={{
                      bottom: `${(tick / chartMaxCount) * 100}%`,
                      transform: tick === 0 ? "translateY(0)" : "translateY(50%)",
                    }}
                  >
                    {tick}
                  </div>
                ))}
              </div>
            </div>
            {/* Rótulos do eixo X */}
            <div className="flex flex-shrink-0 h-8 pl-10">
              <div className="flex flex-1 min-w-0 gap-3 px-1">
                {data.performance_status_6m.map((row) => (
                  <div key={row.month_key} className="flex-1 flex items-center justify-center text-xs font-medium text-[#64748B]">
                    {monthLabelFromKey(row.month_key)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Legenda dos dados</p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[13px] text-slate-700">
              {PERFORMANCE_STATUS_META.map((s) => (
                <div key={s.key} className="inline-flex items-center gap-2">
                  <span className={`inline-block h-3 w-3 rounded-sm ${s.legendClass}`} />
                  <span>
                    {s.key === "effective" && "Green — Controles em conformidade"}
                    {s.key === "warning" && "Yellow — Controles próximo da meta"}
                    {s.key === "critical" && "Red — Controles fora da meta"}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Valores refletem o resultado final após revisão GRC (aprovado/rejeitado/needs_changes).
            </p>
          </div>
        </div>

        {/* Controles críticos: resultado mês = Critical (mesmo critério da página Controles) */}
        <div className="ui-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#E6ECF5] p-6">
            <h2 className="text-lg font-semibold text-[#0F172A]">Controles Críticos</h2>
            <Link className="text-sm font-semibold text-[#06B6D4] hover:underline" href="/controles">
              Ver todos
            </Link>
          </div>

          <CriticalControlsTable controls={data.critical_controls} />
        </div>

        <div className="ui-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#E6ECF5] bg-[#F2F6FF] px-4 py-3">
            <div>
              <div className="text-sm font-medium text-[#0F172A]">Planos de ação vencendo em até 7 dias</div>
              <div className="text-xs text-[#475569]"></div>
            </div>
            <Link href="/action-plans" className="text-sm font-medium text-[#06B6D4] hover:underline">
              Ver todos
            </Link>
          </div>

          {data.action_plans_due_soon.length === 0 ? (
            <div className="p-4 text-sm text-[#475569]">Nenhum plano vencendo nos próximos 7 dias 🎉</div>
          ) : (
            <ActionPlansTable
              rows={data.action_plans_due_soon}
              page={1}
              total={dueSoonTotal}
              showingFrom={dueSoonFrom}
              showingTo={dueSoonTo}
              prevHref={null}
              nextHref={null}
            />
          )}
        </div>
      </div>
    </PageContainer>
  )
}
