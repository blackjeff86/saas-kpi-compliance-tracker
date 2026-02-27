import Link from "next/link"

type Props = {
  from: number
  to: number
  total: number
  page: number
  prevHref?: string | null
  nextHref?: string | null
  itemLabel?: string
}

function navButtonClass(disabled: boolean) {
  return [
    "rounded border px-3 py-1 text-xs font-semibold transition-colors",
    disabled
      ? "cursor-not-allowed border-[#E2E8F0] bg-[#F8FAFC] text-[#94A3B8]"
      : "border-[#D7DEE8] bg-white text-[#475569] hover:bg-[rgba(6,182,212,0.08)] hover:text-[#06B6D4]",
  ].join(" ")
}

export default function TablePaginationFooter({
  from,
  to,
  total,
  page,
  prevHref,
  nextHref,
  itemLabel = "resultados",
}: Props) {
  const prevDisabled = !prevHref
  const nextDisabled = !nextHref

  return (
    <div className="flex flex-col gap-3 border-t border-[#E6ECF5] bg-[#F1F5F9] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs font-medium text-[#475569]">
        Mostrando {from}–{to} de {total} {itemLabel}
      </span>

      <div className="flex items-center gap-2">
        {prevDisabled ? (
          <button type="button" className={navButtonClass(true)} disabled>
            Anterior
          </button>
        ) : (
          <Link href={prevHref} className={navButtonClass(false)} title="Anterior">
            Anterior
          </Link>
        )}

        <span className="min-w-8 rounded border border-[#06B6D4] bg-[#06B6D4] px-3 py-1 text-center text-xs font-bold text-white">
          {page}
        </span>

        {nextDisabled ? (
          <button type="button" className={navButtonClass(true)} disabled>
            Próximo
          </button>
        ) : (
          <Link href={nextHref} className={navButtonClass(false)} title="Próximo">
            Próximo
          </Link>
        )}
      </div>
    </div>
  )
}
