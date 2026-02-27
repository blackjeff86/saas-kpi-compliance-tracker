// app/(app)/dashboard/print/page.tsx
import { formatDatePtBr } from "@/lib/utils"
import { fetchDashboardSummary } from "../actions"

export default async function DashboardPrintPage() {
  const data = await fetchDashboardSummary()

  const today = formatDatePtBr(new Date().toISOString())

  return (
    <div className="max-w-[800px] mx-auto p-8 text-sm text-slate-800">
      
      {/* HEADER */}
      <div className="mb-8 border-b pb-4">
        <h1 className="text-2xl font-bold text-[#1E3A8A]">
          KPI Compliance Tracker
        </h1>
        <p className="text-slate-500">
          Relatório de Dashboard
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Gerado em {today}
        </p>
      </div>

      {/* CARDS RESUMO */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="border rounded-lg p-4 print-avoid-break">
          <div className="text-xs text-slate-500">Controles OK</div>
          <div className="text-xl font-bold text-[#10B981]">
            {data.cards.controls_ok}
          </div>
        </div>

        <div className="border rounded-lg p-4 print-avoid-break">
          <div className="text-xs text-slate-500">Controles Atrasados</div>
          <div className="text-xl font-bold text-[#F59E0B]">
            {data.cards.controls_overdue}
          </div>
        </div>

        <div className="border rounded-lg p-4 print-avoid-break">
          <div className="text-xs text-slate-500">Controles Críticos</div>
          <div className="text-xl font-bold text-[#EF4444]">
            {data.cards.controls_critical}
          </div>
        </div>

        <div className="border rounded-lg p-4 print-avoid-break">
          <div className="text-xs text-slate-500">KPIs Fora da Meta</div>
          <div className="text-xl font-bold text-[#EF4444]">
            {data.cards.kpis_out_of_target}
          </div>
        </div>
      </div>

      {/* DESEMPENHO */}
      <div className="mb-8 print-avoid-break">
        <h2 className="font-semibold text-base mb-3">
          Desempenho de Execução (últimos 6 meses)
        </h2>

        <table className="w-full border text-xs">
          <thead>
            <tr className="bg-[#F2F6FF]">
              <th className="ui-table-th px-3 py-2 text-left">Mês</th>
              <th className="ui-table-th px-3 py-2 text-left">% na meta</th>
            </tr>
          </thead>
          <tbody className="ui-table-tbody">
            {data.performance_6m.map((p) => (
              <tr key={p.month} className="border-t">
                <td className="px-3 py-2">{p.month}</td>
                <td className="px-3 py-2">{p.pct_in_target}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CONTROLES CRÍTICOS */}
      <div className="mb-8 print-avoid-break">
        <h2 className="font-semibold text-base mb-3">
          Controles Críticos
        </h2>

        <table className="w-full border text-xs">
          <thead>
            <tr className="bg-[#F2F6FF]">
              <th className="ui-table-th px-3 py-2 text-left">Código</th>
              <th className="ui-table-th px-3 py-2 text-left">Nome</th>
              <th className="ui-table-th px-3 py-2 text-left">Responsável</th>
              <th className="ui-table-th px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="ui-table-tbody">
            {data.critical_controls.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                  Nenhum controle crítico encontrado
                </td>
              </tr>
            ) : (
              data.critical_controls.map((c) => (
                <tr key={c.control_id} className="border-t">
                  <td className="px-3 py-2 font-mono">{c.control_code}</td>
                  <td className="px-3 py-2">{c.control_name}</td>
                  <td className="px-3 py-2">{c.owner_name ?? "—"}</td>
                  <td className="px-3 py-2">{c.status_label}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* PLANOS VENCENDO */}
      <div className="mb-8 print-avoid-break">
        <h2 className="font-semibold text-base mb-3">
          Planos de ação próximos do vencimento
        </h2>

        <table className="w-full border text-xs">
          <thead>
            <tr className="bg-[#F2F6FF]">
              <th className="ui-table-th px-3 py-2 text-left">Título</th>
              <th className="ui-table-th px-3 py-2 text-left">Prioridade</th>
              <th className="ui-table-th px-3 py-2 text-left">Status</th>
              <th className="ui-table-th px-3 py-2 text-left">Vencimento</th>
            </tr>
          </thead>
          <tbody className="ui-table-tbody">
            {data.action_plans_due_soon.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                  Nenhum plano vencendo
                </td>
              </tr>
            ) : (
              data.action_plans_due_soon.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2">{p.title}</td>
                  <td className="px-3 py-2">{p.priority}</td>
                  <td className="px-3 py-2">{p.status}</td>
                  <td className="px-3 py-2">{formatDatePtBr(p.due_date)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* FOOTER */}
      <div className="text-xs text-slate-400 border-t pt-4">
        KPI Compliance Tracker • Relatório gerado automaticamente
      </div>
    </div>
  )
}

