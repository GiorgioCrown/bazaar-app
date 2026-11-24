import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8" aria-busy="true">
      <Skeleton className="h-10 w-96 max-w-full" />
      <Skeleton className="mt-3 h-5 w-[28rem] max-w-full" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[380px_1fr]">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
      <Skeleton className="mt-6 h-64" />
      <p className="mt-6 text-sm text-muted-foreground">
        Descargando registros de MalwareBazaar y calculando el modelo…
      </p>
    </main>
  );
}
