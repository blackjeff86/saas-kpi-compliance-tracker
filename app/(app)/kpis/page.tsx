import PageContainer from "../PageContainer"
import PageHeader from "../PageHeader"
import { fetchKpis } from "./actions"

function pill(v?: string | null) {
  const s = (v || "").toLowerCase()
  if (s.includes("bool") || s.includes("yes") || s.includes("sim")) return "bg-indigo-50 text-indigo-700 border-indigo-200"
  if (s.includes("percent") || s.includes("%")) return "bg-blue-50 text-blue-700 border-blue-200"
  if (s.includes("number") || s.includes("numeric")) return "bg-slate-50 text-slate-700 border-slate-200"
  return "bg-slate-50 text-slate-700 border-slate-200"
}

function opLabel(op?: string | null) {
  const s = (op || "").toLowerCase()
  if (s === "gte" || s.includes(">=")) return "≥"
  if (s === "lte" || s.includes("<=")) return "≤"
  if (s === "eq" || s === "=") return "="
  return op ?? "—"
}

export default async function KpisPage() {
  const rows = await fetchKpis()

  return (
    <PageContainer variant="default">
      <div className="space-y-4">
        <PageHeader
          title="KPIs"
          description="Catálogo de KPIs por tenant."
          right={<div className="text-sm text-slate-500">{rows.length} registro(s)</div>}
        />

        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="grid grid-cols-12 gap-1 px-4 py-3 text-[11px] font-semibold text-slate-500 border-b bg-slate-50 uppercase tracking-wide">
            <div className="col-span-2 normal-case">Código</div>
            <div className="col-span-5 normal-case">Nome</div>
            <div className="col-span-2 normal-case">Tipo</div>
            <div className="col-span-2 normal-case">Meta</div>
            <div className="col-span-1 text-right normal-case">Evidência</div>
          </div>

          {rows.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">Nenhum KPI encontrado.</div>
          ) : (
            rows.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-12 gap-1 px-4 py-3 text-sm border-b last:border-b-0 items-center"
              >
                <div className="col-span-2">
                  <div className="font-medium">{r.kpi_code}</div>
                  <div className="text-xs text-slate-500">{r.created_at}</div>
                </div>

                <div className="col-span-5 min-w-0">
                  <div className="font-medium truncate">{r.name}</div>
                  <div className="text-xs text-slate-500 line-clamp-1">
                    operator: {r.target_operator ?? "—"} • value: {r.target_value ?? "—"}
                  </div>
                </div>

                <div className="col-span-2">
                  <span className={`inline-flex px-2 py-1 rounded-md border text-xs ${pill(r.kpi_type)}`}>
                    {r.kpi_type ?? "—"}
                  </span>
                </div>

                <div className="col-span-2 text-slate-700">
                  {r.target_value === null || r.target_value === undefined ? (
                    "—"
                  ) : (
                    <span className="font-medium">
                      {opLabel(r.target_operator)} {r.target_value}
                    </span>
                  )}
                </div>

                <div className="col-span-1 flex justify-end">
                  <span
                    className={[
                      "inline-flex px-2 py-1 rounded-md border text-xs",
                      r.evidence_required
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-slate-50 text-slate-700 border-slate-200",
                    ].join(" ")}
                    title={r.evidence_required ? "Obrigatória" : "Opcional"}
                  >
                    {r.evidence_required ? "sim" : "não"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </PageContainer>
  )
}
