import Link from "next/link"
import PageContainer from "../PageContainer"
import PageHeader from "../PageHeader"
import { fetchActionPlans, type ActionPlanListRow } from "./actions-list"

function statusPill(s?: string | null) {
  const v = (s || "").toLowerCase()
  if (v === "done") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (v === "blocked") return "bg-red-50 text-red-700 border-red-200"
  if (v === "in_progress") return "bg-blue-50 text-blue-700 border-blue-200"
  return "bg-slate-50 text-slate-700 border-slate-200"
}

function priorityPill(p?: string | null) {
  const v = (p || "").toLowerCase()
  if (v === "critical") return "bg-red-50 text-red-700 border-red-200"
  if (v === "high") return "bg-amber-50 text-amber-700 border-amber-200"
  if (v === "medium") return "bg-yellow-50 text-yellow-700 border-yellow-200"
  if (v === "low") return "bg-slate-50 text-slate-700 border-slate-200"
  return "bg-slate-50 text-slate-700 border-slate-200"
}

export default async function ActionPlansPage(props: {
  searchParams?: { [key: string]: string | string[] | undefined }
}) {
  const riskParam = props.searchParams?.risk
  const riskId = Array.isArray(riskParam) ? riskParam[0] : riskParam

  const rows: ActionPlanListRow[] = await fetchActionPlans({ riskId })

  return (
    <PageContainer variant="default">
      <div className="space-y-4">
        <PageHeader
          title="Planos de Ação"
          description={
            riskId ? (
              <span className="text-xs text-slate-500">
                Filtrando por risco: <span className="font-mono">{riskId}</span>{" "}
                <Link className="underline" href="/action-plans">
                  limpar filtro
                </Link>
              </span>
            ) : null
          }
          right={<div className="text-sm text-slate-500">{rows.length} registro(s)</div>}
        />

        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="grid grid-cols-12 gap-1 px-4 py-3 text-[11px] font-semibold text-slate-500 border-b bg-slate-50 uppercase tracking-wide">
            <div className="col-span-5 normal-case">Título</div>
            <div className="col-span-2 normal-case">Prioridade</div>
            <div className="col-span-2 normal-case">Status</div>
            <div className="col-span-2 normal-case">Due date</div>
            <div className="col-span-1 text-right normal-case">Abrir</div>
          </div>

          {rows.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">Nenhum plano de ação encontrado.</div>
          ) : (
            rows.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-12 gap-1 px-4 py-3 text-sm border-b last:border-b-0 items-center"
              >
                <div className="col-span-5 min-w-0">
                  <div className="font-medium truncate">{r.title}</div>

                  <div className="text-xs text-slate-500">
                    {r.execution_id ? (
                      <>
                        {r.control_code ?? "—"} • {r.kpi_code ?? "—"} • auto: {r.auto_status ?? "—"} • wf:{" "}
                        {r.workflow_status ?? "—"}
                      </>
                    ) : r.risk_id ? (
                      <>
                        risco: {r.risk_title ?? "—"} • class: {r.risk_classification ?? "—"}
                      </>
                    ) : (
                      <>origem: —</>
                    )}{" "}
                    • upd: {r.updated_at}
                  </div>
                </div>

                <div className="col-span-2">
                  <span className={`inline-flex px-2 py-1 rounded-md border text-xs ${priorityPill(r.priority)}`}>
                    {r.priority}
                  </span>
                </div>

                <div className="col-span-2">
                  <span className={`inline-flex px-2 py-1 rounded-md border text-xs ${statusPill(r.status)}`}>
                    {r.status}
                  </span>
                </div>

                <div className="col-span-2 text-slate-600">{r.due_date ?? "—"}</div>

                <div className="col-span-1 flex justify-end">
                  {r.execution_id ? (
                    <Link className="text-sm underline" href={`/execucoes/${r.execution_id}`}>
                      Abrir
                    </Link>
                  ) : r.risk_id ? (
                    <Link className="text-sm underline" href={`/risks/${r.risk_id}?from=action-plans&risk=${r.risk_id}`}>
                      Abrir
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="text-xs text-slate-500">
          Dica: se você submeter uma execução com auto_status <b>warning/out_of_target</b> ou se o GRC marcar{" "}
          <b>needs_changes/rejected</b>, deve nascer/garantir um action plan aqui. (E futuramente: planos também podem
          nascer de riscos.)
        </div>
      </div>
    </PageContainer>
  )
}
