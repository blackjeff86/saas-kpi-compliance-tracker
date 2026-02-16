"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { submitGrcReview } from "../actions-detail"

type Props = {
  executionId: string
  initialDecision?: string | null
  initialComment?: string | null
}

export default function GrcReviewActions({
  executionId,
  initialDecision,
  initialComment,
}: Props) {
  const router = useRouter()
  const [comment, setComment] = useState(initialComment ?? "")
  const [loading, setLoading] = useState<null | "approved" | "needs_changes" | "rejected">(null)

  async function handle(decision: "approved" | "needs_changes" | "rejected") {
    try {
      setLoading(decision)
      await submitGrcReview({
        executionId,
        decision,
        comment: comment.trim() || "(sem comentário)",
        reviewerEmail: "grc@demo.com",
      })
      router.refresh()
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="rounded-xl border bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium">Revisão GRC</h2>
          <p className="text-xs text-slate-500">
            Decisão atual: <span className="font-medium">{initialDecision ?? "-"}</span>
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handle("approved")}
            disabled={!!loading}
            className="px-3 py-2 text-sm rounded-lg border hover:bg-slate-50 disabled:opacity-50"
          >
            {loading === "approved" ? "Salvando..." : "Approve"}
          </button>

          <button
            onClick={() => handle("needs_changes")}
            disabled={!!loading}
            className="px-3 py-2 text-sm rounded-lg border hover:bg-slate-50 disabled:opacity-50"
          >
            {loading === "needs_changes" ? "Salvando..." : "Needs changes"}
          </button>

          <button
            onClick={() => handle("rejected")}
            disabled={!!loading}
            className="px-3 py-2 text-sm rounded-lg border hover:bg-slate-50 disabled:opacity-50"
          >
            {loading === "rejected" ? "Salvando..." : "Reject"}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-600">Comentário do reviewer</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          className="w-full rounded-lg border p-2 text-sm"
          placeholder="Descreva o motivo / ajustes necessários…"
        />
      </div>
    </div>
  )
}
