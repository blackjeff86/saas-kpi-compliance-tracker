import Link from "next/link"
import PageContainer from "../PageContainer"
import PageHeader from "../PageHeader"
import { fetchControlsPage } from "./actions"
import {
  Search,
  SlidersHorizontal,
  UploadCloud,
  Plus,
  ChevronLeft,
  ChevronRight,
  FileText,
  SquarePen,
  Trash2,
} from "lucide-react"

function riskBadge(v?: string | null) {
  const s = (v || "").toLowerCase()
  if (s.includes("critical")) return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
  if (s.includes("high")) return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
  if (s.includes("med") || s.includes("moderate"))
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
  if (s.includes("low")) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
  return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400"
}

function frameworkPill() {
  return "bg-primary/10 text-primary"
}

function clampInt(v: any, def: number, min: number, max: number) {
  const n = Number(v)
  if (!Number.isFinite(n)) return def
  return Math.max(min, Math.min(max, Math.floor(n)))
}

function pickFirst(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

export default async function ControlesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = (await searchParams) ?? {}
  const q = (pickFirst(sp.q) ?? "").trim()
  const page = clampInt(pickFirst(sp.page), 1, 1, 99999)

  const pageSize = 10
  const offset = (page - 1) * pageSize

  const { rows, total } = await fetchControlsPage({ q, limit: pageSize, offset })

  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + rows.length, total)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const mkHref = (nextPage: number) => {
    const s = new URLSearchParams()
    if (q) s.set("q", q)
    s.set("page", String(nextPage))
    return `/controles?${s.toString()}`
  }

  return (
    <PageContainer variant="default">
      <div className="space-y-6">
        <PageHeader
          title="Controles"
          description="Gerencie e monitore os controles de conformidade da sua organização."
          right={
            <>
              <Link
                href="/controles/import"
                className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm"
              >
                <UploadCloud className="w-4 h-4" />
                Importar CSV
              </Link>

              <Link
                href="/controles/novo"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Novo Controle
              </Link>
            </>
          }
        />

        {/* Filters */}
        <div className="bg-white dark:bg-background-dark border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-wrap items-center gap-4">
          <form className="relative flex-1 min-w-[280px]" action="/controles" method="GET">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <Search className="w-4 h-4 text-slate-400" />
            </div>

            <input
              name="q"
              defaultValue={q}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="Buscar por nome, código ou framework..."
              type="text"
            />

            <input type="hidden" name="page" value="1" />
          </form>

          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            title="(placeholder) filtros avançados"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filtros
          </button>

          <div className="hidden md:block h-6 w-px bg-slate-200 dark:bg-slate-800 mx-2" />

          <div className="text-sm text-slate-500">{total} resultado(s)</div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-background-dark border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Código
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Nome
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Framework
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Frequência
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Risco
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-right">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8">
                      <div className="text-sm text-slate-500">
                        Nenhum controle encontrado{q ? <> para <span className="font-semibold">“{q}”</span></> : null}.
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        Dica: tente buscar por código (ex: CTRL-001) ou framework.
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-sm font-mono text-slate-500 dark:text-slate-400">{r.control_code}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{r.created_at}</div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">{r.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate max-w-[480px]">
                          Controle cadastrado no catálogo.
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {r.framework ? (
                          <span className={`px-2 py-0.5 ${frameworkPill()} text-[10px] font-bold rounded uppercase`}>
                            {r.framework}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-500">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{r.frequency ?? "—"}</td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${riskBadge(
                            r.risk_level
                          )}`}
                        >
                          <span className="w-1 h-1 rounded-full bg-current opacity-60 mr-1.5" />
                          {r.risk_level ?? "—"}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/controles/${r.id}`}
                            className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                            title="Abrir controle"
                            aria-label="Abrir controle"
                          >
                            <FileText className="w-4 h-4" />
                          </Link>

                          <Link
                            href={`/controles/${r.id}/editar`}
                            className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                            title="Editar controle"
                            aria-label="Editar controle"
                          >
                            <SquarePen className="w-4 h-4" />
                          </Link>

                          <button
                            type="button"
                            className="p-1 text-slate-500 hover:text-red-600 transition-colors"
                            title="Excluir controle"
                            aria-label="Excluir controle"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 bg-white dark:bg-background-dark border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-sm text-slate-500">
              Mostrando{" "}
              <span className="font-semibold text-slate-900 dark:text-white">{from}</span> a{" "}
              <span className="font-semibold text-slate-900 dark:text-white">{to}</span> de{" "}
              <span className="font-semibold text-slate-900 dark:text-white">{total}</span> resultados
            </div>

            <div className="flex items-center gap-2 justify-end">
              <Link
                aria-disabled={page <= 1}
                href={mkHref(Math.max(1, page - 1))}
                className={`p-1 rounded border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-primary hover:border-primary ${
                  page <= 1 ? "pointer-events-none opacity-50" : ""
                }`}
                title="Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </Link>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                  let start = Math.max(1, page - 2)
                  let end = Math.min(totalPages, start + 4)
                  start = Math.max(1, end - 4)
                  const p = start + i
                  if (p > end) return null

                  const active = p === page
                  return (
                    <Link
                      key={p}
                      href={mkHref(p)}
                      className={`w-8 h-8 grid place-items-center rounded text-sm font-semibold ${
                        active
                          ? "bg-primary text-white"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      {p}
                    </Link>
                  )
                })}
                {totalPages > 5 ? <span className="px-1 text-slate-400">...</span> : null}
              </div>

              <Link
                aria-disabled={page >= totalPages}
                href={mkHref(Math.min(totalPages, page + 1))}
                className={`p-1 rounded border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-primary hover:border-primary ${
                  page >= totalPages ? "pointer-events-none opacity-50" : ""
                }`}
                title="Próxima"
              >
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
