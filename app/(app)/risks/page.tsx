// app/(app)/risks/page.tsx
import Link from "next/link"
import PageContainer from "../PageContainer"
import { fetchRisksFilterOptions, fetchRiskCountsByClassification, fetchRisks } from "./actions"
import { DEFAULT_SOURCES, DEFAULT_NATUREZAS } from "./constants"
import FiltersBar from "./FiltersBar"
import RisksTable from "./RisksTable"
import { Plus, Download, ChevronLeft, ChevronRight } from "lucide-react"

function pickFirst(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

function clampInt(v: unknown, def: number, min: number, max: number) {
  const n = Number(v)
  if (!Number.isFinite(n)) return def
  return Math.max(min, Math.min(max, Math.floor(n)))
}

function buildHref(params: Record<string, string>, page: number) {
  const s = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v) s.set(k, v)
  })
  s.set("page", String(page))
  return `/risks?${s.toString()}`
}

function miniBarClass(kind: "critical" | "high" | "med" | "low") {
  if (kind === "critical") return "bg-red-600"
  if (kind === "high") return "bg-orange-500"
  if (kind === "med") return "bg-yellow-500"
  return "bg-emerald-500"
}

export default async function RisksPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = (await props.searchParams) ?? {}

  const q = (pickFirst(sp.q) ?? "").trim()
  const page = clampInt(pickFirst(sp.page), 1, 1, 99999)
  const classification = (pickFirst(sp.classification) ?? "").trim()
  const source = (pickFirst(sp.source) ?? "").trim()
  const natureza = (pickFirst(sp.natureza) ?? "").trim()

  const pageSize = 10
  const offset = (page - 1) * pageSize

  const filterOpts = {
    q: q || undefined,
    classification: classification || undefined,
    source: source || undefined,
    natureza: natureza || undefined,
  }

  const [opts, { rows, total }, counts] = await Promise.all([
    fetchRisksFilterOptions(),
    fetchRisks({ ...filterOpts, limit: pageSize, offset }),
    fetchRiskCountsByClassification(filterOpts),
  ])

  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + rows.length, total)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const baseParams: Record<string, string> = { q, classification, source, natureza }
  const mkHref = (nextPage: number) => buildHref(baseParams, nextPage)

  const totalFiltered = counts.critical + counts.high + counts.med + counts.low
  const pct = (n: number) => (totalFiltered > 0 ? Math.round((n * 100) / totalFiltered) : 0)

  return (
    <PageContainer variant="default">
      <div className="space-y-6">
        {/* HERO */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gestão de Riscos</h1>
            <p className="text-slate-500 text-sm mt-1">
              Monitoramento dinâmico e visualização de exposição a riscos corporativos.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm"
              title="Exportar relatório (UX)"
            >
              <Download className="w-4 h-4" />
              Exportar Relatório
            </button>

            <Link
              href="/risks/novo"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Novo Risco
            </Link>
          </div>
        </div>

        {/* Heatmap + Insights (mesma altura) */}
        <div className="grid grid-cols-12 gap-6 w-full items-stretch">
          {/* Heatmap */}
          <div className="col-span-12 xl:col-span-8 min-w-0">
            <div className="bg-white dark:bg-background-dark border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm w-full h-full flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex w-2.5 h-2.5 rounded bg-primary" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Risk Heatmap Summary (5x5)
                </h2>
              </div>

              {/* Área do heatmap cresce, mas com limite de tamanho para não estourar */}
              <div className="flex-1 min-h-0">
                <div className="flex items-start gap-4 w-full h-full min-w-0">
                  <div className="pt-1 shrink-0">
                    <div
                      className="text-[10px] font-bold text-slate-400 uppercase tracking-widest"
                      style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}
                    >
                      PROBABILIDADE
                    </div>
                  </div>

                  {/* O truque: limitar o tamanho do quadrado e centralizar */}
                  <div className="min-w-0 flex-1 flex flex-col items-center">
                    <div className="w-full max-w-[460px] aspect-square">
                      <div className="grid grid-cols-5 grid-rows-5 gap-2 w-full h-full">
                        {Array.from({ length: 25 }).map((_, i) => (
                          <div
                            key={i}
                            className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30"
                          />
                        ))}
                      </div>
                    </div>

                    <div className="mt-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      IMPACTO
                    </div>
                  </div>
                </div>
              </div>

              {/* Legenda fixa no rodapé do card */}
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px]">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-600" />
                  <span className="text-slate-600 dark:text-slate-400">Crítico:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{counts.critical}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  <span className="text-slate-600 dark:text-slate-400">Alto:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{counts.high}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-500" />
                  <span className="text-slate-600 dark:text-slate-400">Médio:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{counts.med}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-slate-600 dark:text-slate-400">Baixo:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{counts.low}</span>
                </span>

                <span className="text-slate-400 ml-auto">
                  Total: {totalFiltered} riscos (filtros aplicados)
                </span>
              </div>
            </div>
          </div>

          {/* Painel lateral: dois cards com mesma altura somada do heatmap */}
          <div className="col-span-12 xl:col-span-4 min-w-0">
            <div className="h-full flex flex-col gap-4">
              {/* Resumo */}
              <div className="bg-white dark:bg-background-dark border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex-1">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Resumo
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Total</div>
                    <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{totalFiltered}</div>
                  </div>

                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Críticos</div>
                    <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{counts.critical}</div>
                  </div>

                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Altos</div>
                    <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{counts.high}</div>
                  </div>

                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Médios</div>
                    <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{counts.med}</div>
                  </div>
                </div>
              </div>

              {/* Distribuição */}
              <div className="bg-white dark:bg-background-dark border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex-1">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Distribuição por criticidade
                </div>

                <div className="mt-4 space-y-3">
                  {([
                    ["Crítico", counts.critical, "critical"],
                    ["Alto", counts.high, "high"],
                    ["Médio", counts.med, "med"],
                    ["Baixo", counts.low, "low"],
                  ] as const).map(([label, value, kind]) => (
                    <div key={label} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-700 dark:text-slate-200">{label}</span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {value} • {pct(value)}%
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-900/50 overflow-hidden">
                        <div className={`h-full ${miniBarClass(kind)}`} style={{ width: `${pct(value)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 text-xs text-slate-400">
                  * Percentuais calculados sobre os riscos retornados com os filtros atuais.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FILTROS */}
        <FiltersBar
          total={total}
          opts={{
            classifications: opts.classifications,
            sources: [...new Set([...DEFAULT_SOURCES, ...opts.sources])],
            naturezas: [...new Set([...DEFAULT_NATUREZAS, ...opts.naturezas])],
          }}
        />

        {/* TABELA + PAGINAÇÃO */}
        <div className="bg-white dark:bg-background-dark border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          {rows.length === 0 ? (
            <div className="px-6 py-10">
              <div className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                Nenhum risco encontrado com os filtros atuais.
              </div>
              <div className="text-xs text-slate-400 mt-2">
                Os riscos são cadastrados no catálogo (risk_catalog) e podem ser vinculados a controles.
              </div>
            </div>
          ) : (
            <RisksTable rows={rows} />
          )}

          <div className="px-6 py-4 bg-white dark:bg-background-dark border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-sm text-slate-500">
              Mostrando <span className="font-semibold text-slate-900 dark:text-white">{from}</span> a{" "}
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

              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500">Página</span>
                <span className="w-8 h-8 rounded flex items-center justify-center text-sm font-semibold bg-primary text-white">
                  {page}
                </span>
                <span className="text-slate-500">/</span>
                <span className="text-slate-500 font-semibold">{totalPages}</span>
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