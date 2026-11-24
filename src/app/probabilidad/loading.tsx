import { PageSkeleton } from "@/components/section";

export default function Loading() {
  return <PageSkeleton message="Verificando axiomas y comparando P(A∩B) con P(A)·P(B)…" />;
}
