"use client";

/**
 * Wrappers dinámicos (`ssr: false`) de las escenas Three.js. Importa desde aquí
 * en Server Components; three/@react-three/fiber solo se descargan en el cliente.
 *
 * Uso de ParticleHero en otra página (p. ej. /analisis):
 *   import { ParticleHero } from "@/components/three";
 *   <ParticleHero className="rounded-xl border border-border bg-card/40 p-6">
 *     <h1>…</h1>
 *   </ParticleHero>
 * Es decorativo (aria-hidden), no anima con prefers-reduced-motion y no hace
 * nada sin WebGL. Dale altura/padding desde `className`.
 */
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SceneSkeleton } from "./skeleton";

const loading = () => <SceneSkeleton />;

export const FamilyTerrain = dynamic(
  () => import("./family-terrain").then((m) => m.FamilyTerrain),
  { ssr: false, loading },
);
export const SizeHistogram3D = dynamic(
  () => import("./size-histogram-3d").then((m) => m.SizeHistogram3D),
  { ssr: false, loading },
);
export const PercentileColumns = dynamic(
  () => import("./percentile-columns").then((m) => m.PercentileColumns),
  { ssr: false, loading },
);
export const FamilyNetwork3D = dynamic(
  () => import("./family-network-3d").then((m) => m.FamilyNetwork3D),
  { ssr: false, loading },
);
const ParticleField = dynamic(
  () => import("./particle-hero").then((m) => m.ParticleField),
  { ssr: false, loading: () => null },
);

/** Contenedor con campo de partículas de fondo; los children se ven siempre. */
export function ParticleHero({
  className,
  count,
  children,
}: {
  className?: string;
  count?: number;
  children?: ReactNode;
}) {
  return (
    <div className={cn("relative isolate overflow-hidden", className)}>
      <ParticleField count={count} />
      {children}
    </div>
  );
}
