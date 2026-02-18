// app/(app)/controles/page.tsx
import Link from "next/link"
import PageContainer from "../PageContainer"
import PageHeader from "../PageHeader"
import { fetchControlsPage, fetchControlsFilterOptions } from "./actions"
import FiltersBar from "./FiltersBar"
import ControlsTable from "./ControlsTable"
import { UploadCloud, Plus, ChevronLeft, ChevronRight } from "lucide-react"

function clampInt(v: any, def: number, min: number, max: number) {
  const n = Number(v)
  if (!Number.isFinite(n)) return def
  return Math.max(min, Math.min(max, Math.floor(n)))
}

function pickFirst(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

function buildHref(params: Record<string, string>, page: number) {
  const s = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v) s.set(k, v)
  })
  s.set("page", String(page))
  return `/controles?${s.toString()}`
}

// ✅ mês atual em YYYY-MM (America/Sao_Paulo)
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

export default async function ControlesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = (await searchParams) ?? {}

  const q = (pickFirst(sp.q) ?? "").trim()
  const page = clampInt(pickFirst(sp.page), 1, 1, 99999)

  // ✅ agora SEMPRE começa no mês atual
  const mes_ref = (pickFirst(sp.mes_ref) ?? "").trim() || currentYYYYMM()

  const owner = (pickFirst(sp.owner) ?? "").trim()
  const focal = (pickFirst(sp.focal) ?? "").trim()
  const frequency = (pickFirst(sp.frequency) ?? "").trim()
  const risk = (pickFirst(sp.risk) ?? "").trim()
  const framework = (pickFirst(sp.framework) ?? "").trim()

  const pageSize = 10
  const offset = (page - 1) * pageSize

  const opts = await fetchControlsFilterOptions()

  const { rows, total } = await fetchControlsPage({
    q,
    limit: pageSize,
    offset,
    mes_ref,
    framework,
    frequency,
    risk,
    owner,
    focal,
  })

  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + rows.length, total)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const baseParams: Record<string, string> = {
    q,
    mes_ref,
    owner,
    focal,
    frequency,
    risk,
    framework,
  }

  const mkHref = (nextPage: number) => buildHref(baseParams, nextPage)

  return (
    <PageContainer variant="default">
      <div className="space-y-6">
        <PageHeader
          title="Controles"
          description="Gerencie e monitore os controles de conformidade."
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

        <FiltersBar total={total} opts={opts} />

        <div className="bg-white dark:bg-background-dark border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          {rows.length === 0 ? (
            <div className="px-4 py-10">
              <div className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                Nenhum controle encontrado com os filtros atuais.
              </div>
              <div className="text-xs text-slate-400 mt-2">
                Dica: selecione um <b>Mês ref</b> para ver o resultado mensal (pior KPI).
              </div>
            </div>
          ) : (
            // ✅ PASSA o mes_ref pra tabela montar os links mantendo o período
            <ControlsTable rows={rows as any} mes_ref={mes_ref} />
          )}

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

              <div className="text-sm text-slate-500">
                Página <span className="font-semibold text-slate-900 dark:text-white">{page}</span> /{" "}
                <span className="font-semibold text-slate-900 dark:text-white">{totalPages}</span>
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
