import { Skeleton } from "@/components/ui/skeleton";

export function SceneSkeleton({ label = "Cargando escena 3D…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite">
      <Skeleton className="h-[22rem] w-full rounded-lg sm:h-[30rem]" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
