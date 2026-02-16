import Link from "next/link"
import PageContainer from "../PageContainer"
import PageHeader from "../PageHeader"
import { fetchRisks, type RiskRow } from "./actions"

function pillClass(v: string) {
  const s = (v || "").toLowerCase()
  if (s === "critical") return "bg-red-50 text-red-700 border-red-200"
  if (s === "high") return "bg-amber-50 text-amber-700 border-amber-200"
  if (s === "med") return "bg-yellow-50 text-yellow-800 border-yellow-200"
  if (s === "low") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  return "bg-slate-50 text-slate-700 border-slate-200"
}

export default async function RisksPage() {
  const rows: RiskRow[] = await fetchRisks()

  return (
    <PageContainer variant="default">
      <div className="space-y-4">
        <PageHeader
          title="Riscos"
          right={<div className="text-sm text-slate-500">{rows.length} registro(s)</div>}
        />

        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="grid grid-cols-12 gap-1 px-4 py-3 text-[11px] font-semibold text-slate-500 border-b bg-slate-50 uppercase tracking-wide">
            <div className="col-span-5 normal-case">Título</div>
            <div className="col-span-2 normal-case">Classificação</div>
            <div className="col-span-2 normal-case">Status</div>
            <div className="col-span-2 normal-case">Score</div>
            <div className="col-span-1 text-right normal-case">Abrir</div>
          </div>

          {rows.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">Nenhum risco encontrado.</div>
          ) : (
            rows.map((r) => {
              const riskId = r.id

              return (
                <div
                  key={riskId ?? `${r.title}-${r.created_at}`}
                  className="grid grid-cols-12 gap-1 px-4 py-3 text-sm border-b last:border-b-0 items-center"
                >
                  <div className="col-span-5 min-w-0">
                    <div className="font-medium truncate">{r.title}</div>
                    <div className="text-xs text-slate-500">domínio: {r.domain} • criado: {r.created_at}</div>
                  </div>

                  <div className="col-span-2">
                    <span className={`inline-flex px-2 py-1 rounded-md border text-xs ${pillClass(r.classification)}`}>
                      {r.classification}
                    </span>
                  </div>

                  <div className="col-span-2 text-slate-700">{r.status}</div>

                  <div className="col-span-2 text-slate-700">{r.risk_score}</div>

                  <div className="col-span-1 flex justify-end">
                    {riskId ? (
                      <Link className="text-sm underline" href={`/risks/${riskId}`}>
                        Abrir
                      </Link>
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
