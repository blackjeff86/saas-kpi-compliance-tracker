// app/(app)/dashboard/page.tsx
import Link from "next/link"
import PageContainer from "../PageContainer"
import { fetchDashboardSummary } from "./actions"
import { CheckCircle2, Clock, AlertTriangle, TrendingDown, MoreVertical, Download } from "lucide-react"
import FiltersBar from "./FiltersBar"

function badgeClass(v: string) {
  const s = (v || "").toLowerCase()
  if (s.includes("out_of_target") || s.includes("rejected")) return "bg-red-50 text-red-700 border-red-200"
  if (s.includes("warning") || s.includes("needs_changes") || s.includes("under_review"))
    return "bg-amber-50 text-amber-700 border-amber-200"
  if (s.includes("approved") || s.includes("in_target") || s.includes("done") || s === "ok")
    return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (s.includes("submitted")) return "bg-blue-50 text-blue-700 border-blue-200"
  return "bg-slate-50 text-slate-700 border-slate-200"
}

function cardIcon(kind: "ok" | "overdue" | "critical" | "out") {
  const base = "w-10 h-10 rounded-lg flex items-center justify-center"
  if (kind === "ok")
    return (
      <div className={`${base} bg-primary/10 text-primary`}>
        <CheckCircle2 className="w-5 h-5" />
      </div>
    )
  if (kind === "overdue")
    return (
      <div className={`${base} bg-amber-500/10 text-amber-600`}>
        <Clock className="w-5 h-5" />
      </div>
    )
  if (kind === "critical")
    return (
      <div className={`${base} bg-fuchsia-500/10 text-fuchsia-600`}>
        <AlertTriangle className="w-5 h-5" />
      </div>
    )
  return (
    <div className={`${base} bg-sky-500/10 text-sky-600`}>
      <TrendingDown className="w-5 h-5" />
    </div>
  )
}

function StatusPill({ kind, label }: { kind: "danger" | "warning" | "info" | "neutral"; label: string }) {
  const cls =
    kind === "danger"
      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
      : kind === "warning"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
      : kind === "info"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
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
              <h1 className="text-2xl font-semibold">Dashboard</h1>
              <p className="text-sm text-slate-500">Visão geral</p>
            </div>

            <div className="no-print flex items-center gap-2">
              <Link
                href={printHref}
                target="_blank"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-95 transition"
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
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              {cardIcon("ok")}
              <span className="text-emerald-600 text-xs font-semibold bg-emerald-50 px-2 py-1 rounded">OK</span>
            </div>
            <div className="text-slate-500 text-sm font-medium">Controles OK</div>
            <div className="text-2xl font-bold mt-1">{data.cards.controls_ok}</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              {cardIcon("overdue")}
              <span className="text-amber-700 text-xs font-semibold bg-amber-50 px-2 py-1 rounded">Atrasados</span>
            </div>
            <div className="text-slate-500 text-sm font-medium">Controles Atrasados</div>
            <div className="text-2xl font-bold mt-1">{data.cards.controls_overdue}</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              {cardIcon("critical")}
              <span className="text-fuchsia-700 text-xs font-semibold bg-fuchsia-50 px-2 py-1 rounded">Crítico</span>
            </div>
            <div className="text-slate-500 text-sm font-medium">Controles Críticos</div>
            <div className="text-2xl font-bold mt-1">{data.cards.controls_critical}</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              {cardIcon("out")}
              <span className="text-red-600 text-xs font-semibold bg-red-50 px-2 py-1 rounded">Fora</span>
            </div>
            <div className="text-slate-500 text-sm font-medium">KPIs Fora da Meta</div>
            <div className="text-2xl font-bold mt-1">{data.cards.kpis_out_of_target}</div>
          </div>
        </div>

        {/* Desempenho 6m */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
            <div>
              <h2 className="text-lg font-semibold">Desempenho de Execução</h2>
              <p className="text-sm text-slate-500">Histórico de conformidade nos (últimos 6 meses)</p>
            </div>
            <div className="text-xs text-slate-500">
              <span className="font-semibold">{frameworkName}</span> • {String(month).padStart(2, "0")}/{year}
            </div>
          </div>

          <div className="h-64 w-full flex items-end gap-2">
            {data.performance_6m.map((p) => {
              const pct = Math.max(0, Math.min(100, p.pct_in_target))
              return (
                <div key={p.month} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full h-full bg-primary/10 rounded-t-lg relative overflow-hidden flex items-end">
                    <div
                      className="w-full bg-primary/70 rounded-t-lg"
                      style={{ height: `${Math.max(6, pct)}%` }}
                      title={`${pct}%`}
                    />
                  </div>
                  <div className="text-xs text-slate-400 font-medium">{p.month}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Controles críticos */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Controles Críticos</h2>
            <Link className="text-primary text-sm font-semibold hover:underline" href="/controles">
              Ver todos
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Código</th>
                  <th className="px-6 py-4">Nome do Controle</th>
                  <th className="px-6 py-4">Responsável</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-sm">
                {data.critical_controls.length === 0 ? (
                  <tr>
                    <td className="px-6 py-6 text-slate-500" colSpan={5}>
                      Nenhum controle crítico encontrado.
                    </td>
                  </tr>
                ) : (
                  data.critical_controls.map((c) => (
                    <tr key={c.control_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-mono font-medium text-slate-500">{c.control_code}</td>

                      <td className="px-6 py-4 font-medium">
                        <Link href={`/controles/${c.control_id}`} className="hover:underline">
                          {c.control_name}
                        </Link>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700">
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

                      <td className="px-6 py-4">
                        <StatusPill kind={c.status_kind} label={c.status_label} />
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button className="p-1 hover:bg-slate-200 rounded transition-colors" title="Mais ações" type="button">
                          <MoreVertical className="w-4 h-4 text-slate-600" />
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
          <div className="rounded-xl border bg-white overflow-hidden">
            <div className="px-4 py-3 border-b bg-slate-50">
              <div className="text-sm font-medium">Execuções por workflow_status</div>
            </div>
            <div className="p-4 space-y-2">
              {data.executions_by_workflow.length === 0 ? (
                <div className="text-sm text-slate-500">Sem dados.</div>
              ) : (
                data.executions_by_workflow.map((r) => (
                  <div key={r.workflow_status} className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-1 rounded-md border ${badgeClass(r.workflow_status)}`}>
                      {r.workflow_status}
                    </span>
                    <span className="text-sm font-medium">{r.count}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-white overflow-hidden">
            <div className="px-4 py-3 border-b bg-slate-50">
              <div className="text-sm font-medium">Execuções por auto_status</div>
            </div>
            <div className="p-4 space-y-2">
              {data.executions_by_auto.length === 0 ? (
                <div className="text-sm text-slate-500">Sem dados.</div>
              ) : (
                data.executions_by_auto.map((r) => (
                  <div key={r.auto_status} className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-1 rounded-md border ${badgeClass(r.auto_status)}`}>{r.auto_status}</span>
                    <span className="text-sm font-medium">{r.count}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Planos de ação vencendo em até 7 dias</div>
              <div className="text-xs text-slate-500"></div>
            </div>
            <Link href="/action-plans" className="text-sm underline">
              Ver todos
            </Link>
          </div>

          {data.action_plans_due_soon.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">Nenhum plano vencendo nos próximos 7 dias 🎉</div>
          ) : (
            <div className="divide-y">
              {data.action_plans_due_soon.map((p) => (
                <div key={p.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.title}</div>
                    <div className="text-xs text-slate-500">
                      {p.control_code ?? "—"} • {p.kpi_code ?? "—"} • execução{" "}
                      <Link className="underline" href={`/execucoes/${p.execution_id}`}>
                        {p.execution_id.slice(0, 8)}…
                      </Link>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-md border ${badgeClass(p.priority)}`}>{p.priority}</span>
                    <span className={`text-xs px-2 py-1 rounded-md border ${badgeClass(p.status)}`}>{p.status}</span>
                    <span className="text-xs text-slate-600">{p.due_date}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
            <div className="text-sm font-medium">Execuções recentes</div>
            <Link href="/execucoes" className="text-sm underline">
              Ver todas
            </Link>
          </div>

          {data.recent_executions.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">Nenhuma execução encontrada.</div>
          ) : (
            <div className="divide-y">
              {data.recent_executions.map((e) => (
                <Link key={e.id} href={`/execucoes/${e.id}`} className="block p-4 hover:bg-slate-50">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {e.control_code} • {e.kpi_code}
                      </div>
                      <div className="text-xs text-slate-500">
                        {e.period_start} → {e.period_end} • {e.created_at}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs px-2 py-1 rounded-md border ${badgeClass(e.auto_status)}`}>{e.auto_status}</span>
                      <span className={`text-xs px-2 py-1 rounded-md border ${badgeClass(e.workflow_status)}`}>
                        {e.workflow_status}
                      </span>
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
