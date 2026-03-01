"use client"

import { useRouter } from "next/navigation"

type Control = {
  control_id: string
  control_code: string
  control_name: string
  owner_name: string | null
  status_label: string
  status_kind: "danger" | "warning" | "info" | "neutral"
}

function StatusPill({ kind, label }: { kind: Control["status_kind"]; label: string }) {
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

export default function CriticalControlsTable({
  controls,
}: {
  controls: Control[]
}) {
  const router = useRouter()

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-[#F2F6FF] border-b border-slate-200 dark:border-slate-800">
            <th className="ui-table-th px-4 py-3">Código</th>
            <th className="ui-table-th px-4 py-3">Nome do controle</th>
            <th className="ui-table-th px-4 py-3">Responsável</th>
            <th className="ui-table-th px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="ui-table-tbody divide-y divide-slate-100 dark:divide-slate-800">
          {controls.length === 0 ? (
            <tr>
              <td className="px-4 py-6 text-[#475569]" colSpan={4}>
                Nenhum controle crítico encontrado.
              </td>
            </tr>
          ) : (
            controls.map((c) => (
              <tr
                key={c.control_id}
                onClick={() => router.push(`/controles/${c.control_id}`)}
                className="group cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/30"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    router.push(`/controles/${c.control_id}`)
                  }
                }}
                title="Clique para ver detalhes do controle"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="mt-1 h-8 w-1 rounded-full bg-transparent group-hover:bg-[#06B6D4]/60 transition-colors" />
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        <span className="font-mono text-slate-500 dark:text-slate-400">
                          {c.control_code}
                        </span>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 min-w-0">
                  <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[220px] block group-hover:text-[#06B6D4] transition-colors">
                    {c.control_name}
                  </span>
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
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
