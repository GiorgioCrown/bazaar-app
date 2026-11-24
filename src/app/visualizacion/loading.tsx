import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main
      className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6"
      aria-busy="true"
    >
      <Skeleton className="h-44 w-full rounded-xl" />
      <Skeleton className="h-[34rem] w-full rounded-xl" />
      <div className="grid gap-6">
        <Skeleton className="h-[32rem] rounded-xl" />
        <Skeleton className="h-[32rem] rounded-xl" />
      </div>
      <span className="sr-only" role="status">
        Cargando visualizaciones…
      </span>
    </main>
  );
}
