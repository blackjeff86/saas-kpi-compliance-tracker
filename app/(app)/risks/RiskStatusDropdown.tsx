"use client"

import { useRouter } from "next/navigation"
import { updateRiskStatus } from "./actions"

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "open", label: "Aberto" },
  { value: "mitigating", label: "Em mitigação" },
  { value: "accepted", label: "Aceito" },
  { value: "closed", label: "Fechado" },
]

type Props = {
  riskId: string
  currentStatus: string
}

export default function RiskStatusDropdown({ riskId, currentStatus }: Props) {
  const router = useRouter()
  const value = ["open", "mitigating", "accepted", "closed"].includes(currentStatus) ? currentStatus : "open"

  return (
    <select
      value={value}
      onChange={async (e) => {
        const newStatus = e.target.value as "open" | "mitigating" | "accepted" | "closed"
        const res = await updateRiskStatus(riskId, newStatus)
        if (res.ok) router.refresh()
      }}
      className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
    >
      {STATUS_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
