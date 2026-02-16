import React from "react"

export default function PageHeader({
  title,
  description,
  right,
  eyebrow,
}: {
  title: string
  description?: React.ReactNode
  right?: React.ReactNode
  eyebrow?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
            {eyebrow}
          </div>
        ) : null}

        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          {title}
        </h1>

        {description ? (
          <div className="mt-1 text-sm text-slate-500">
            {description}
          </div>
        ) : null}
      </div>

      {right ? (
        <div className="flex items-center gap-3 shrink-0">
          {right}
        </div>
      ) : null}
    </div>
  )
}
