// app/(app)/risks/novo/page.tsx
import { redirect } from "next/navigation"

/** Redireciona para /risks — o fluxo de Novo Risco usa modal na página principal (padrão Planos de Ação). */
export default function NovoRiscoPage() {
  redirect("/risks")
}
