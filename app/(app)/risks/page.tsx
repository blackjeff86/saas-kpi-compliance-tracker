// app/(app)/risks/page.tsx
import Link from "next/link"
import SetPageTitle from "../components/SetPageTitle"
import PageContainer from "../PageContainer"
import {
  fetchRisksFilterOptions,
  fetchRisks,
  fetchRiskAnalytics,
} from "./actions"
import { DEFAULT_SOURCES, DEFAULT_NATUREZAS } from "./constants"
import FiltersBar from "./FiltersBar"
import RisksTable from "./RisksTable"
import NewRiskModal from "./NewRiskModal"
import { Download } from "lucide-react"
import TablePaginationFooter from "../components/TablePaginationFooter"

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
  if (kind === "critical") return "bg-risk-critical"
  if (kind === "high") return "bg-risk-high"
  if (kind === "med") return "bg-risk-medium"
  return "bg-risk-low"
}

function heatCellClass(score: number, hasValue: boolean) {
  if (!hasValue) return "bg-background border border-border/70"
  if (score >= 20) return "bg-risk-critical/10 border border-risk-critical/20"
  if (score >= 12) return "bg-risk-high/10 border border-risk-high/20"
  if (score >= 6) return "bg-risk-medium/10 border border-risk-medium/20"
  return "bg-risk-low/10 border border-risk-low/20"
}

function heatBadgeClass(score: number) {
  if (score >= 20) return "bg-risk-critical/15 text-risk-critical ring-risk-critical/25"
  if (score >= 12) return "bg-risk-high/15 text-risk-high ring-risk-high/25"
  if (score >= 6) return "bg-risk-medium/15 text-risk-medium ring-risk-medium/25"
  return "bg-risk-low/15 text-risk-low ring-risk-low/25"
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

  const [opts, { rows, total }, analytics] = await Promise.all([
    fetchRisksFilterOptions(),
    fetchRisks({ ...filterOpts, limit: pageSize, offset }),
    fetchRiskAnalytics(filterOpts),
  ])
  const counts = analytics.counts
  const heatmap = analytics.heatmap

  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + rows.length, total)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const baseParams: Record<string, string> = { q, classification, source, natureza }
  const mkHref = (nextPage: number) => buildHref(baseParams, nextPage)

  const totalFiltered = counts.critical + counts.high + counts.med + counts.low
  const pct = (n: number) => (totalFiltered > 0 ? Math.round((n * 100) / totalFiltered) : 0)

  const sqlBackfill = `UPDATE risk_catalog
SET
  impact = COALESCE(impact, (floor(random() * 5) + 1)::int),
  likelihood = COALESCE(likelihood, (floor(random() * 5) + 1)::int)
WHERE tenant_id = '${heatmap.tenantId}'::uuid
  AND (impact IS NULL OR likelihood IS NULL);`

  return (
    <PageContainer variant="default">
      <SetPageTitle title="Gestão de Riscos" />
      <div className="space-y-6">
        {/* HERO */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-text-primary">Gestão de Riscos</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Monitoramento dinâmico e visualização de exposição a riscos corporativos.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled
               className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-slate-50"
              title="Exportar relatório (UX)"
            >
              <Download className="w-4 h-4" />
              Exportar Relatório
            </button>

            <NewRiskModal
              sources={[...new Set([...DEFAULT_SOURCES, ...opts.sources])]}
              naturezas={[...new Set([...DEFAULT_NATUREZAS, ...opts.naturezas])]}
            />
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6 w-full items-stretch">
          <div className="col-span-12 xl:col-span-8 min-w-0">
            <div className="flex h-full w-full flex-col rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                   <span className="inline-flex h-2.5 w-2.5 rounded bg-primary" />
                   <h2 className="text-sm font-bold uppercase tracking-wider text-text-primary">
                    Risk Heatmap Summary (5x5)
                  </h2>
                </div>

                 <div className="hidden items-center gap-4 text-xs text-text-secondary sm:flex">
                  <span>
                    Média Impacto:{" "}
                     <span className="font-semibold text-text-primary">{heatmap.totals.impact}</span>
                  </span>
                  <span>
                    Média Prob.:{" "}
                     <span className="font-semibold text-text-primary">{heatmap.totals.likelihood}</span>
                  </span>
                </div>
              </div>

              {/* Apenas quando há riscos mas sem impact/likelihood válidos (não mostrar quando filtro retorna vazio) */}
              {heatmap.totalFiltered > 0 && heatmap.validCount === 0 && (
                 <div className="mb-4 rounded-lg border border-risk-high/20 bg-risk-high/10 px-4 py-3 text-sm text-risk-high">
                  <div className="font-semibold">
                    {heatmap.missing} risco(s) sem Impacto/Probabilidade (1–5). Preencha para exibir no heatmap.
                  </div>
                  <div className="mt-2 text-xs opacity-90">SQL sugerido (Neon):</div>
                   <pre className="mt-2 overflow-auto rounded bg-white p-2 text-[11px] leading-4 text-text-secondary">
                    {sqlBackfill}
                  </pre>
                </div>
              )}

              <div className="flex-1 min-h-0">
                <div className="flex items-start gap-4 w-full h-full min-w-0">
                  <div className="pt-1 shrink-0">
                    <div
                       className="text-[10px] font-bold uppercase tracking-widest text-text-muted"
                      style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}
                    >
                      PROBABILIDADE (5=alto)
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 flex flex-col items-center">
                    <div className="w-full max-w-[460px] aspect-square">
                      <div className="grid grid-cols-5 grid-rows-5 gap-2 w-full h-full">
                        {/* Y: likelihood 5 (top) → 1 (bottom). matrix[0]=L1, matrix[4]=L5. Display matrix[4-y] so row 0 = L5. */}
                        {[4, 3, 2, 1, 0].map((rowIdx, y) =>
                          heatmap.matrix[rowIdx].map((value, x) => {
                            const impact = x + 1
                            const likelihood = 5 - y
                            const score = impact * likelihood
                            const hasValue = value > 0

                            return (
                              <div
                                key={`${x}-${y}`}
                                title={`Impacto ${impact} • Probabilidade ${likelihood} • ${value} risco(s)`}
                                className={[
                                  "rounded-lg border aspect-square",
                                  "flex items-center justify-center p-1",
                                    heatCellClass(score, hasValue),
                                ].join(" ")}
                              >
                                {hasValue ? (
                                  <span
                                    className={[
                                      "inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ring-2",
                                      heatBadgeClass(score),
                                    ].join(" ")}
                                  >
                                    {value}
                                  </span>
                                ) : null}
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>

                     <div className="mt-2 flex w-full max-w-[460px] justify-between text-[10px] font-bold uppercase tracking-widest text-text-muted">
                      <span>1</span>
                      <span>2</span>
                      <span>3</span>
                      <span>4</span>
                      <span>5</span>
                    </div>
                     <div className="mt-1 text-center text-[10px] font-bold uppercase tracking-widest text-text-muted">
                      IMPACTO →
                    </div>
                  </div>
                </div>
              </div>

               <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-4 text-[11px]">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-risk-critical" />
                   <span className="text-text-secondary">Crítico:</span>
                   <span className="font-semibold text-text-primary">{counts.critical}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-risk-high" />
                   <span className="text-text-secondary">Alto:</span>
                   <span className="font-semibold text-text-primary">{counts.high}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-risk-medium" />
                   <span className="text-text-secondary">Médio:</span>
                   <span className="font-semibold text-text-primary">{counts.med}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-risk-low" />
                   <span className="text-text-secondary">Baixo:</span>
                   <span className="font-semibold text-text-primary">{counts.low}</span>
                </span>

                 <span className="ml-auto text-text-secondary">
                  Total: {totalFiltered} riscos (filtros aplicados)
                </span>
              </div>
            </div>
          </div>

          {/* Painel lateral - Distribuição por criticidade (mesma altura que Heatmap) */}
          <div className="col-span-12 xl:col-span-4 min-w-0 flex">
             <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="text-xs font-bold uppercase tracking-wider text-text-muted">
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
                        <span className="text-text-primary">{label}</span>
                        <span className="text-text-secondary">
                          {value} • {pct(value)}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-background">
                        <div className={`h-full ${miniBarClass(kind)}`} style={{ width: `${pct(value)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                 <div className="mt-4 text-xs text-text-muted">
                  * Percentuais calculados sobre os riscos retornados com os filtros atuais.
                </div>
              </div>
          </div>
        </div>

        <FiltersBar
          total={total}
          opts={{
            classifications: opts.classifications,
            sources: [...new Set([...DEFAULT_SOURCES, ...opts.sources])],
            naturezas: [...new Set([...DEFAULT_NATUREZAS, ...opts.naturezas])],
          }}
        />

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {rows.length === 0 ? (
            <div className="px-6 py-10">
               <div className="text-sm font-medium text-text-secondary">
                Nenhum risco encontrado com os filtros atuais.
              </div>
               <div className="mt-2 text-xs text-text-muted">
                Os riscos são cadastrados no catálogo (risk_catalog) e podem ser vinculados a controles.
              </div>
            </div>
          ) : (
            <RisksTable rows={rows} returnTo={`/risks?${new URLSearchParams(baseParams).toString()}`} />
          )}

          <TablePaginationFooter
            from={from}
            to={to}
            total={total}
            page={page}
            prevHref={page <= 1 ? null : mkHref(Math.max(1, page - 1))}
            nextHref={page >= totalPages ? null : mkHref(Math.min(totalPages, page + 1))}
          />
        </div>
      </div>
    </PageContainer>
  )
}
