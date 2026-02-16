"use client"

import { FileDown } from "lucide-react"

export default function ExportPdfButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm hover:bg-slate-50 inline-flex items-center gap-2"
      title="Exportar em PDF (Salvar como PDF)"
    >
      <FileDown className="w-4 h-4" />
      Exportar PDF
    </button>
  )
}
