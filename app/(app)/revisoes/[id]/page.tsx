// app/(app)/revisoes/[id]/page.tsx
import { notFound } from "next/navigation"
import PageContainer from "../../PageContainer"
import ReviewDetailClient from "./ReviewDetailClient"
import { fetchReviewDetail } from "./actions"

export default async function RevisaoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const executionId = (id || "").trim()
  if (!executionId) return notFound()

  const detail = await fetchReviewDetail({ executionId })
  if (!detail) return notFound()

  return (
    <PageContainer>
      <ReviewDetailClient detail={detail} />
    </PageContainer>
  )
}
