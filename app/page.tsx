// src/app/page.tsx  (ou app/page.tsx — conforme seu projeto)
import { redirect } from "next/navigation"

export default function Home() {
  redirect("/login")
}
