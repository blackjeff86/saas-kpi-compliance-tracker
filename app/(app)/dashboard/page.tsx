// app/(app)/dashboard/page.tsx
import Link from "next/link"
import PageContainer from "../PageContainer"
import { fetchDashboardSummary } from "./actions"
import { CheckCircle2, Clock, AlertTriangle, TrendingDown, MoreVertical, Download } from "lucide-react"
import FiltersBar from "./FiltersBar"

function badgeClass(v: string) {
  const s = (v || "").toLowerCase()
  if (s.includes("out_of_target") || s.includes("rejected")) return "ui-badge-danger"
  if (s.includes("warning") || s.includes("needs_changes") || s.includes("under_review")) return "ui-badge-warning"
  if (s.includes("approved") || s.includes("in_target") || s.includes("done") || s === "ok") return "ui-badge-success"
  if (s.includes("submitted")) return "ui-badge-info"
  return "ui-badge-neutral"
}

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

function StatusPill({ kind, label }: { kind: "danger" | "warning" | "info" | "neutral"; label: string }) {
  const cls =
    kind === "danger"
      ? "ui-badge-danger"
      : kind === "warning"
      ? "ui-badge-warning"
      : kind === "info"
      ? "ui-badge-info"
      : "ui-badge-neutral"

  return (
    <span className={`inline-flex items-center gap-1.5 ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
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

  const printHref = `/dashboard/print?frameworkId=${encodeURIComponent(frameworkId ?? "")}&year=${year}&month=${month}`

  return (
    <PageContainer variant="dashboard">
      <div className="space-y-6">
        {/* Header + filtros + PDF */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-[#0F172A]">Dashboard</h1>
              <p className="text-sm text-[#475569]">Visão geral</p>
            </div>

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
          </div>

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

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="ui-card-hover p-5">
            <div className="flex items-center justify-between mb-4">
              {cardIcon("ok")}
              <span className="ui-badge-success">OK</span>
            </div>
            <div className="text-sm font-medium text-[#475569]">Controles OK</div>
            <div className="mt-1 text-3xl font-semibold text-[#0F172A]">{data.cards.controls_ok}</div>
          </div>

          <div className="ui-card-hover p-5">
            <div className="flex items-center justify-between mb-4">
              {cardIcon("overdue")}
              <span className="ui-badge-warning">Atrasados</span>
            </div>
            <div className="text-sm font-medium text-[#475569]">Controles Atrasados</div>
            <div className="mt-1 text-3xl font-semibold text-[#0F172A]">{data.cards.controls_overdue}</div>
          </div>

          <div className="ui-card-hover p-5">
            <div className="flex items-center justify-between mb-4">
              {cardIcon("critical")}
              <span className="ui-badge-danger">Crítico</span>
            </div>
            <div className="text-sm font-medium text-[#475569]">Controles Críticos</div>
            <div className="mt-1 text-3xl font-semibold text-[#0F172A]">{data.cards.controls_critical}</div>
          </div>

          <div className="ui-card-hover p-5">
            <div className="flex items-center justify-between mb-4">
              {cardIcon("out")}
              <span className="ui-badge-danger">Fora</span>
            </div>
            <div className="text-sm font-medium text-[#475569]">KPIs Fora da Meta</div>
            <div className="mt-1 text-3xl font-semibold text-[#0F172A]">{data.cards.kpis_out_of_target}</div>
          </div>
        </div>

        {/* Desempenho 6m */}
        <div className="ui-card p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
            <div>
            <h2 className="text-lg font-semibold text-[#0F172A]">Desempenho de Execução</h2>
            <p className="text-sm text-[#475569]">Histórico de conformidade nos (últimos 6 meses)</p>
            </div>
            <div className="text-xs text-[#475569]">
              <span className="font-semibold">{frameworkName}</span> • {String(month).padStart(2, "0")}/{year}
            </div>
          </div>

          <div className="h-64 w-full flex items-end gap-2">
            {data.performance_6m.map((p) => {
              const pct = Math.max(0, Math.min(100, p.pct_in_target))
              return (
                <div key={p.month} className="flex-1 flex flex-col items-center gap-2">
                  <div className="relative flex h-full w-full items-end overflow-hidden rounded-t-lg bg-[rgba(6,182,212,0.12)]">
                    <div
                      className="w-full rounded-t-lg bg-[#06B6D4]/70"
                      style={{ height: `${Math.max(6, pct)}%` }}
                      title={`${pct}%`}
                    />
                  </div>
                  <div className="text-xs font-medium text-[#64748B]">{p.month}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Controles críticos */}
        <div className="ui-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#E6ECF5] p-6">
            <h2 className="text-lg font-semibold text-[#0F172A]">Controles Críticos</h2>
            <Link className="text-sm font-semibold text-[#06B6D4] hover:underline" href="/controles">
              Ver todos
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F2F6FF] border-b border-slate-200 dark:border-slate-800">
                  <th className="ui-table-th px-4 py-3">Código</th>
                  <th className="ui-table-th px-4 py-3">Nome do controle</th>
                  <th className="ui-table-th px-4 py-3">Responsável</th>
                  <th className="ui-table-th px-4 py-3">Status</th>
                  <th className="ui-table-th px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>

              <tbody className="ui-table-tbody divide-y divide-slate-100 dark:divide-slate-800">
                {data.critical_controls.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-[#475569]" colSpan={5}>
                      Nenhum controle crítico encontrado.
                    </td>
                  </tr>
                ) : (
                  data.critical_controls.map((c) => (
                    <tr key={c.control_id} className="group transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="mt-1 h-8 w-1 rounded-full bg-transparent group-hover:bg-[#06B6D4]/60 transition-colors" />
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              <span className="font-mono text-slate-500 dark:text-slate-400">{c.control_code}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 min-w-0">
                        <Link href={`/controles/${c.control_id}`} className="font-semibold text-slate-900 dark:text-white truncate max-w-[220px] block hover:underline">
                          {c.control_name}
                        </Link>
                      </td>

                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(6,182,212,0.12)] text-[10px] font-bold text-[#06B6D4]">
                            {(c.owner_name || "—")
                              .split(/\s+/)
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((p) => p[0]?.toUpperCase())
                              .join("") || "—"}
                          </div>
                          <span>{c.owner_name ?? "—"}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <StatusPill kind={c.status_kind} label={c.status_label} />
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button className="rounded p-1 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800" title="Mais ações" type="button">
                          <MoreVertical className="h-4 w-4 text-[#475569]" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Seus blocos atuais (mantidos) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="ui-card overflow-hidden">
            <div className="border-b border-[#E6ECF5] bg-[#F2F6FF] px-4 py-3">
              <div className="text-sm font-medium text-[#0F172A]">Execuções por workflow_status</div>
            </div>
            <div className="p-4 space-y-2">
              {data.executions_by_workflow.length === 0 ? (
                <div className="text-sm text-[#475569]">Sem dados.</div>
              ) : (
                data.executions_by_workflow.map((r) => (
                  <div key={r.workflow_status} className="flex items-center justify-between">
                    <span className={badgeClass(r.workflow_status)}>{r.workflow_status}</span>
                    <span className="text-sm font-medium text-[#0F172A]">{r.count}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="ui-card overflow-hidden">
            <div className="border-b border-[#E6ECF5] bg-[#F2F6FF] px-4 py-3">
              <div className="text-sm font-medium text-[#0F172A]">Execuções por auto_status</div>
            </div>
            <div className="p-4 space-y-2">
              {data.executions_by_auto.length === 0 ? (
                <div className="text-sm text-[#475569]">Sem dados.</div>
              ) : (
                data.executions_by_auto.map((r) => (
                  <div key={r.auto_status} className="flex items-center justify-between">
                    <span className={badgeClass(r.auto_status)}>{r.auto_status}</span>
                    <span className="text-sm font-medium text-[#0F172A]">{r.count}</span>
                  </div>
                ))
              )}
            </div>
          </div>
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
            <div className="divide-y divide-[#E6ECF5]">
              {data.action_plans_due_soon.map((p) => (
                <div key={p.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium truncate text-[#0F172A]">{p.title}</div>
                    <div className="text-xs text-[#475569]">
                      {p.control_code ?? "—"} • {p.kpi_code ?? "—"} • execução{" "}
                      {p.execution_id ? (
                        <Link className="text-[#06B6D4] underline hover:no-underline" href={`/execucoes/${p.execution_id}`}>
                          {p.execution_id.slice(0, 8)}…
                        </Link>
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={badgeClass(p.priority)}>{p.priority}</span>
                    <span className={badgeClass(p.status)}>{p.status}</span>
                    <span className="text-xs text-[#475569]">{p.due_date}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ui-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#E6ECF5] bg-[#F2F6FF] px-4 py-3">
            <div className="text-sm font-medium text-[#0F172A]">Execuções recentes</div>
            <Link href="/execucoes" className="text-sm font-medium text-[#06B6D4] hover:underline">
              Ver todas
            </Link>
          </div>

          {data.recent_executions.length === 0 ? (
            <div className="p-4 text-sm text-[#475569]">Nenhuma execução encontrada.</div>
          ) : (
            <div className="divide-y divide-[#E6ECF5]">
              {data.recent_executions.map((e) => (
                <Link key={e.id} href={`/execucoes/${e.id}`} className="block p-4 transition-colors hover:bg-[rgba(6,182,212,0.08)]">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-medium truncate text-[#0F172A]">
                        {e.control_code} • {e.kpi_code}
                      </div>
                      <div className="text-xs text-[#475569]">
                        {e.period_start} → {e.period_end} • {e.created_at}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={badgeClass(e.auto_status)}>{e.auto_status}</span>
                      <span className={badgeClass(e.workflow_status)}>{e.workflow_status}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  )
}
