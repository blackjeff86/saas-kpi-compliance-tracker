// app/(app)/kpis/novo/page.tsx — redirect para /kpis (formulário agora é modal)
import { redirect } from "next/navigation"

export default function NovoKpiRedirect() {
  redirect("/kpis")
}
