// app/(app)/auditorias/AuditHubClient.tsx
"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import type { AuditHubData, AuditHubCampaignRow } from "./actions"
import TablePaginationFooter from "../components/TablePaginationFooter"

function clsx(...p: Array<string | false | null | undefined>) {
  return p.filter(Boolean).join(" ")
}

function statusPill(status: string) {
  const s = (status || "").toLowerCase()
  if (s.includes("active") || s.includes("exec")) return "bg-blue-100 text-blue-700 border-blue-200"
  if (s.includes("draft") || s.includes("plan")) return "bg-amber-100 text-amber-700 border-amber-200"
  if (s.includes("closed") || s.includes("final")) return "bg-emerald-100 text-emerald-700 border-emerald-200"
  return "bg-slate-100 text-slate-700 border-slate-200"
}

function statusLabel(status: string) {
  const s = (status || "").toLowerCase()
  if (s === "active") return "Em Execução"
  if (s === "draft") return "Planejamento"
  if (s === "closed") return "Finalizada"
  return status || "—"
}

function fmtPeriod(start: string | null, end: string | null) {
  if (!start && !end) return "—"
  const s = start ? fmtDateBR(start) : "—"
  const e = end ? fmtDateBR(end) : "—"
  return `${s} - ${e}`
}

function fmtDateBR(v: string) {
  const raw = (v || "").trim()
  if (!raw) return "—"
  const parts = raw.split("-")
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleDateString("pt-BR")
}

type Props = {
  initialData: AuditHubData
}

export default function AuditHubClient({ initialData }: Props) {
  const [q, setQ] = useState("")
  const [status, setStatus] = useState<"all" | "active" | "draft" | "closed">("all")

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase()
    return initialData.campaigns.filter((r) => {
      const matchesText =
        !query ||
        `${r.name} ${r.framework ?? ""} ${r.owner_name ?? ""}`
          .toLowerCase()
          .includes(query)

      const matchesStatus = status === "all" || r.status === status
      return matchesText && matchesStatus
    })
  }, [initialData.campaigns, q, status])

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard
          label="Auditorias Ativas"
          value={`${initialData.kpis.active_count}`}
          hint={initialData.kpis.active_delta_month >= 0 ? `+${initialData.kpis.active_delta_month} este mês` : `${initialData.kpis.active_delta_month} este mês`}
          hintTone={initialData.kpis.active_delta_month >= 0 ? "ok" : "warn"}
        />
        <KpiCard
          label="Progresso Médio"
          value={`${Math.round(initialData.kpis.avg_progress_pct)}%`}
          right={
            <div className="w-16 h-1.5 bg-slate-100 rounded-full mb-1.5">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${Math.max(0, Math.min(100, initialData.kpis.avg_progress_pct))}%` }}
              />
            </div>
          }
        />
        <KpiCard
          label="Aguardando Validação"
          value={`${initialData.kpis.awaiting_validation}`}
          right={<span className="text-amber-500">⏳</span>}
        />
        <KpiCard
          label="Prazos Vencidos"
          value={`${initialData.kpis.overdue_count}`}
          valueTone="danger"
          right={<span className="text-red-500">⚠</span>}
        />
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-sm font-bold text-slate-800">
            Campanhas em Andamento
          </h2>

          <div className="flex gap-2 items-center">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                🔎
              </span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9 pr-4 py-2 text-xs border border-slate-200 bg-white rounded-lg focus:ring-2 focus:ring-primary/20"
                placeholder="Filtrar campanhas..."
              />
            </div>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="py-2 px-3 text-xs border border-slate-200 bg-white rounded-lg"
              title="Status"
            >
              <option value="all">Todos</option>
              <option value="active">Em Execução</option>
              <option value="draft">Planejamento</option>
              <option value="closed">Finalizada</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <colgroup>
              <col className="w-[30%]" />
              <col className="w-[11%]" />
              <col className="w-[13%]" />
              <col className="w-[14%]" />
              <col className="w-[14%]" />
              <col className="w-[14%]" />
              <col className="w-[4%]" />
            </colgroup>
            <thead>
              <tr className="bg-[#F2F6FF] border-b border-slate-200 dark:border-slate-800">
                <th className="ui-table-th pl-8 pr-6 py-3">Nome da Campanha</th>
                <th className="ui-table-th px-6 py-3">Framework</th>
                <th className="ui-table-th px-6 py-3 text-left">Status</th>
                <th className="ui-table-th px-6 py-3">Progresso</th>
                <th className="ui-table-th px-6 py-3">Responsável</th>
                <th className="ui-table-th px-6 py-3">Período</th>
                <th className="ui-table-th px-6 py-3 text-left whitespace-nowrap">Ações</th>
              </tr>
            </thead>

            <tbody className="ui-table-tbody divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-sm text-slate-500">
                    Nenhuma campanha encontrada com os filtros atuais.
                  </td>
                </tr>
              ) : (
                rows.map((r) => <Row key={r.id} r={r} />)
              )}
            </tbody>
          </table>
        </div>

        <TablePaginationFooter
          from={rows.length === 0 ? 0 : 1}
          to={rows.length}
          total={initialData.campaigns.length}
          page={1}
          prevHref={null}
          nextHref={null}
          itemLabel="campanhas"
        />
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  hint,
  hintTone,
  valueTone,
  right,
}: {
  label: string
  value: string
  hint?: string
  hintTone?: "ok" | "warn"
  valueTone?: "danger"
  right?: React.ReactNode
}) {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-end justify-between gap-3">
        <span
          className={clsx(
            "text-2xl font-bold",
            valueTone === "danger" ? "text-red-600" : "text-slate-900"
          )}
        >
          {value}
        </span>
        <div className="flex flex-col items-end">
          {right ? right : null}
          {hint ? (
            <span className={clsx("text-xs font-medium", hintTone === "ok" ? "text-green-600" : "text-slate-500")}>
              {hint}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Row({ r }: { r: AuditHubCampaignRow }) {
  const pct = Math.max(0, Math.min(100, Math.round(r.progress_pct ?? 0)))

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="pl-8 pr-6 py-4">
        <span className="font-semibold text-slate-900">{r.name}</span>
      </td>

      <td className="px-6 py-4">
        <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-[10px] font-bold">
          {r.framework ?? "—"}
        </span>
      </td>

      <td className="px-6 py-4">
        <span
          className={clsx(
            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase",
            statusPill(r.status)
          )}
        >
          <span className="w-1 h-1 rounded-full bg-current opacity-70" />
          {statusLabel(r.status)}
        </span>
      </td>

      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full">
            <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[11px] font-bold text-slate-600">{pct}%</span>
        </div>
      </td>

      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">
            {initials(r.owner_name ?? "—")}
          </div>
          <span className="text-xs font-medium">{r.owner_name ?? "—"}</span>
        </div>
      </td>

      <td className="px-6 py-4">
        <span className="text-xs text-slate-500">{fmtPeriod(r.period_start, r.period_end)}</span>
      </td>

      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <Link
            href={`/auditorias/${r.id}/acompanhamento`}
            className="px-2 py-1 text-xs font-semibold text-slate-600 hover:text-primary hover:bg-primary/10 rounded"
            title="Acompanhamento"
          >
            Acompanhar
          </Link>
        </div>
      </td>
    </tr>
  )
}

function initials(name: string) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean)
  const a = parts[0]?.[0] ?? "?"
  const b = parts.length > 1 ? parts[parts.length - 1][0] : ""
  return (a + b).toUpperCase()
}
