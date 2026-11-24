import { PageSkeleton } from "@/components/section";

export default function Loading() {
  return <PageSkeleton message="Descargando registros de MalwareBazaar y calculando el modelo…" />;
}
