// app/(app)/kpis/page.tsx
import Link from "next/link"
import PageContainer from "../PageContainer"
import PageHeader from "../PageHeader"
import { fetchKpis, fetchKpisFilterOptions, fetchControlsForKpiSelect, fetchKpisSummary } from "./actions"
import FiltersBar from "./FiltersBar"
import KpisTable from "./KpisTable"
import NewKpiModal from "./NewKpiModal"
import { ClipboardList, CheckCircle, AlertTriangle, XCircle } from "lucide-react"
import TablePaginationFooter from "../components/TablePaginationFooter"

type SearchParams = Record<string, string | string[] | undefined>

function pickFirst(v: string | string[] | undefined) {
  if (Array.isArray(v)) return v[0]
  return v
}

function clampInt(v: any, def: number, min: number, max: number) {
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
  return `/kpis?${s.toString()}`
}

// ✅ mês atual em YYYY-MM (America/Sao_Paulo) — mesmo padrão de Controles
function currentYYYYMM() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === "year")?.value ?? ""
  const m = parts.find((p) => p.type === "month")?.value ?? ""
  return `${y}-${m}`
}

export default async function KpisPage(props: { searchParams?: Promise<SearchParams> }) {
  const sp = props.searchParams ? await props.searchParams : {}

  const q = (pickFirst(sp.q) || "").trim()
  const page = clampInt(pickFirst(sp.page), 1, 1, 99999)
  const mes_ref = (pickFirst(sp.mes_ref) || "").trim() || currentYYYYMM()
  const framework = (pickFirst(sp.framework) || "").trim()
  const frequency = (pickFirst(sp.frequency) || "").trim()
  const owner = (pickFirst(sp.owner) || "").trim()
  const focal = (pickFirst(sp.focal) || "").trim()
  const resultado = (pickFirst(sp.resultado) || "").trim()

  const pageSize = 10
  const offset = (page - 1) * pageSize

  const [opts, { rows, total }, controls, summary] = await Promise.all([
    fetchKpisFilterOptions(),
    fetchKpis({
      mes_ref,
      q,
      framework,
      frequency,
      owner,
      focal,
      resultado,
      limit: pageSize,
      offset,
    }),
    fetchControlsForKpiSelect(),
    fetchKpisSummary({
      mes_ref,
      q,
      framework,
      frequency,
      owner,
      focal,
      resultado,
    }),
  ])

  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + rows.length, total)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const baseParams: Record<string, string> = {
    q,
    mes_ref,
    framework,
    frequency,
    owner,
    focal,
    resultado,
  }
  const mkHref = (nextPage: number) => buildHref(baseParams, nextPage)

  return (
    <PageContainer variant="default">
      <div className="space-y-4">
        {/* ✅ Cabeçalho (sem duplicar título/subtítulo) + botão na cor bg-primary */}
        <PageHeader
          title="Gestão de KPIs"
          description="Monitore e gerencie os indicadores de conformidade da sua organização."
          right={
            <div className="flex items-center gap-3">
              <NewKpiModal controls={controls} />
            </div>
          }
        />

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-primary/10 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-lg bg-primary/10 p-2 text-primary">
                <ClipboardList className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold text-slate-400">{summary.total > 0 ? "Ativo" : "—"}</span>
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total de KPIs</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{summary.total}</p>
          </div>

          <div className="rounded-xl border border-primary/10 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-lg bg-emerald-100 dark:bg-emerald-900/30 p-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Em conformidade</span>
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Em Conformidade</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{summary.green}</p>
          </div>

          <div className="rounded-xl border border-primary/10 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-lg bg-amber-100 dark:bg-amber-900/30 p-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400">Atenção</span>
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Atenção</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{summary.yellow}</p>
          </div>

          <div className="rounded-xl border border-primary/10 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-lg bg-red-100 dark:bg-red-900/30 p-2 text-red-700 dark:text-red-400">
                <XCircle className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold text-red-700 dark:text-red-400">Não conformidade</span>
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Não Conformidade</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{summary.red}</p>
          </div>
        </div>

        {/* ✅ FiltersBar (client) agora real, não mock */}
        <FiltersBar
          total={total}
          opts={{
            months: opts.months,
            frameworks: opts.frameworks,
            frequencies: opts.frequencies,
            owners: opts.owners,
            focals: opts.focals,
          }}
        />

        {/* Table card */}
        <div className="bg-white dark:bg-background-dark border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          {rows.length === 0 ? (
            <div className="px-4 py-10">
              <div className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                Nenhum KPI encontrado com os filtros atuais.
              </div>
              <div className="text-xs text-slate-400 mt-2">
                Dica: selecione o <b>Mês ref</b> para ver o resultado mensal do KPI.
              </div>
            </div>
          ) : (
            <KpisTable
              rows={rows as any}
              mes_ref={mes_ref}
              returnTo={`/kpis?${new URLSearchParams(baseParams).toString()}`}
            />
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
