"use client"

import React, { useEffect } from "react"
import { usePageTitle } from "./contexts/PageTitleContext"

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
  const { setTitle } = usePageTitle()

  useEffect(() => {
    setTitle(title)
    return () => setTitle(null)
  }, [title, setTitle])

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            {eyebrow}
          </div>
        ) : null}

        <h1 className="text-2xl font-bold tracking-tight text-text-primary">
          {title}
        </h1>

        {description ? (
          <div className="mt-1 text-sm text-text-secondary">
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
