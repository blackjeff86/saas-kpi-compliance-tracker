import Link from "next/link"
import PageContainer from "../PageContainer"
import PageHeader from "../PageHeader"
import { fetchExecutions } from "./actions"
import { submitExecution } from "./actions-submit"

function autoClass(v?: string | null) {
  const s = (v || "").toLowerCase()
  if (s.includes("in_target")) return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (s.includes("warning")) return "bg-amber-50 text-amber-700 border-amber-200"
  if (s.includes("out")) return "bg-red-50 text-red-700 border-red-200"
  if (s.includes("not_applicable")) return "bg-slate-50 text-slate-700 border-slate-200"
  return "bg-slate-50 text-slate-700 border-slate-200"
}

function wfClass(v?: string | null) {
  const s = (v || "").toLowerCase()
  if (s.includes("submitted")) return "bg-blue-50 text-blue-700 border-blue-200"
  if (s.includes("under_review")) return "bg-indigo-50 text-indigo-700 border-indigo-200"
  if (s.includes("needs_changes")) return "bg-amber-50 text-amber-700 border-amber-200"
  if (s.includes("approved")) return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (s.includes("rejected")) return "bg-red-50 text-red-700 border-red-200"
  return "bg-slate-50 text-slate-700 border-slate-200"
}

export default async function ExecucoesPage() {
  const rows = await fetchExecutions()

  return (
    <PageContainer variant="default">
      <div className="space-y-4">
        <PageHeader
          title="Execuções"
          right={<div className="text-sm text-slate-500">{rows.length} registro(s)</div>}
        />

        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="grid grid-cols-12 gap-1 px-4 py-3 text-[11px] font-semibold text-slate-500 border-b bg-slate-50 uppercase tracking-wide">
            <div className="col-span-3 normal-case">Controle</div>
            <div className="col-span-4 normal-case">KPI</div>
            <div className="col-span-3 normal-case">Período</div>
            <div className="col-span-1 normal-case">Status</div>
            <div className="col-span-1 text-right normal-case">Ação</div>
          </div>

          {rows.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">Nenhuma execução encontrada.</div>
          ) : (
            rows.map((r) => {
              const canSubmit =
                r.workflow_status === "draft" ||
                r.workflow_status === "in_progress" ||
                r.workflow_status === "needs_changes"

              async function submit() {
                "use server"
                await submitExecution(r.id)
              }

              return (
                <div
                  key={r.id}
                  className="grid grid-cols-12 gap-1 px-4 py-3 text-sm hover:bg-slate-50 border-b last:border-b-0 items-center"
                >
                  <Link href={`/execucoes/${r.id}`} className="contents">
                    <div className="col-span-3">
                      <div className="font-medium">{r.control_code}</div>
                      <div className="text-xs text-slate-500 line-clamp-1">{r.control_name}</div>
                    </div>

                    <div className="col-span-4">
                      <div className="font-medium">{r.kpi_code}</div>
                      <div className="text-xs text-slate-500 line-clamp-1">{r.kpi_name}</div>
                    </div>

                    <div className="col-span-3 text-slate-600">
                      {r.period_start} → {r.period_end}
                    </div>

                    <div className="col-span-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">auto:</span>
                        <span className={`inline-flex items-center px-2 py-1 rounded-md border text-xs ${autoClass(r.auto_status)}`}>
                          {r.auto_status}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">wf:</span>
                        <span className={`inline-flex items-center px-2 py-1 rounded-md border text-xs ${wfClass(r.workflow_status)}`}>
                          {r.workflow_status}
                        </span>
                      </div>
                    </div>
                  </Link>

                  <div className="col-span-1 flex justify-end">
                    {canSubmit ? (
                      <form action={submit}>
                        <button className="px-2 py-1 text-xs rounded-md border hover:bg-slate-50" title="Submeter para revisão">
                          Submeter
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </PageContainer>
  )
}
