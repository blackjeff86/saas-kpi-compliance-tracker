// app/(app)/kpis/page.tsx
import PageContainer from "../PageContainer"
import PageHeader from "../PageHeader"
import { fetchKpis } from "./actions"

function pill(v?: string | null) {
  const s = (v || "").toLowerCase()
  if (s.includes("bool") || s.includes("yes") || s.includes("sim"))
    return "bg-indigo-50 text-indigo-700 border-indigo-200"
  if (s.includes("percent") || s.includes("%"))
    return "bg-blue-50 text-blue-700 border-blue-200"
  if (s.includes("number") || s.includes("numeric"))
    return "bg-slate-50 text-slate-700 border-slate-200"
  return "bg-slate-50 text-slate-700 border-slate-200"
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
            rows.map((r) => {
              const isActive = Boolean((r as any).is_active) // ✅ se não vier, fica false (ideal é vir do backend)
              const targetValue = (r as any).target_value

              const metaText =
                !isActive || targetValue === null || targetValue === undefined ? "—" : String(targetValue)

              return (
                <div
                  key={(r as any).id}
                  className="grid grid-cols-12 gap-1 px-4 py-3 text-sm border-b last:border-b-0 items-center"
                >
                  <div className="col-span-2">
                    <div className="font-medium">{(r as any).kpi_code}</div>
                    <div className="text-xs text-slate-500">{(r as any).created_at}</div>
                  </div>

                  <div className="col-span-5 min-w-0">
                    <div className="font-medium truncate">{(r as any).kpi_name}</div>
                    <div className="text-xs text-slate-500 line-clamp-1">
                      operator: {(r as any).target_operator ?? "—"} • value: {(r as any).target_value ?? "—"}
                      {!isActive ? " • inativo" : ""}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <span className={`inline-flex px-2 py-1 rounded-md border text-xs ${pill((r as any).kpi_type)}`}>
                      {(r as any).kpi_type ?? "—"}
                    </span>
                  </div>

                  {/* ✅ Meta: SOMENTE target_value (e ignora se is_active=false) */}
                  <div className="col-span-2 text-slate-700">
                    <span className="font-medium">{metaText}</span>
                  </div>

                  <div className="col-span-1 flex justify-end">
                    <span
                      className={[
                        "inline-flex px-2 py-1 rounded-md border text-xs",
                        (r as any).evidence_required
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-50 text-slate-700 border-slate-200",
                      ].join(" ")}
                      title={(r as any).evidence_required ? "Obrigatória" : "Opcional"}
                    >
                      {(r as any).evidence_required ? "sim" : "não"}
                    </span>
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
