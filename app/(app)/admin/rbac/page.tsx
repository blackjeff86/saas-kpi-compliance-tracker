// app/(app)/admin/rbac/page.tsx
import { redirect } from "next/navigation"

export default function RbacPage() {
  redirect("/configuracoes?tab=permissoes")
}
