"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import { Controls } from "./controls";
import { useReducedMotion, useWebGL } from "./use-env";
import { COLORS } from "../viz/theme";
import { cn } from "@/lib/utils";

export type Tip = {
  /** Coordenadas de cliente del puntero. */
  x: number;
  y: number;
  title: string;
  lines: string[];
};

type Props = {
  ariaLabel: string;
  /** Resumen textual para lectores de pantalla (visible solo para ellos). */
  summary: string;
  /** Tabla/lista accesible: alternativa si no hay WebGL y `<details>` si lo hay. */
  table: ReactNode;
  legend?: ReactNode;
  tip?: Tip | null;
  camera: { position: [number, number, number]; fov?: number };
  target?: [number, number, number];
  minDistance?: number;
  maxDistance?: number;
  autoRotate?: boolean;
  className?: string;
  children: ReactNode;
};

function setCameraFit(
  cam: PerspectiveCamera,
  base: [number, number, number],
  target: [number, number, number],
  aspect: number,
) {
  // Retrocede la cámara en contenedores estrechos para que la escena quepa.
  const k = Math.min(2.2, Math.max(1, (1.8 / aspect) ** 1.1));
  cam.position.set(
    target[0] + (base[0] - target[0]) * k,
    target[1] + (base[1] - target[1]) * k,
    target[2] + (base[2] - target[2]) * k,
  );
  cam.updateProjectionMatrix();
}

/** Ajusta la distancia de la cámara al formato del contenedor (móvil/columnas). */
function FitCamera({
  base,
  target,
}: {
  base: [number, number, number];
  target: [number, number, number];
}) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const [bx, by, bz] = base;
  const [tx, ty, tz] = target;
  useEffect(() => {
    setCameraFit(camera, [bx, by, bz], [tx, ty, tz], width / Math.max(height, 1));
  }, [camera, bx, by, bz, tx, ty, tz, width, height]);
  return null;
}

export function TipBox({ tip }: { tip: Tip }) {
  const flip = typeof window !== "undefined" && tip.x > window.innerWidth - 240;
  return (
    <div
      role="status"
      className="pointer-events-none fixed z-50 max-w-60 rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg"
      style={{
        left: tip.x,
        top: tip.y,
        transform: `translate(${flip ? "calc(-100% - 14px)" : "14px"}, 14px)`,
      }}
    >
      <p className="font-heading text-sm font-semibold">{tip.title}</p>
      {tip.lines.map((l) => (
        <p key={l} className="text-muted-foreground">
          {l}
        </p>
      ))}
    </div>
  );
}

/**
 * Marco común de las escenas: Canvas acotado (DPR ≤ 2), OrbitControls con
 * amortiguación, render bajo demanda, pausa fuera de pantalla, detección de
 * WebGL y alternativa accesible en tabla.
 */
export function SceneFrame({
  ariaLabel,
  summary,
  table,
  legend,
  tip,
  camera,
  target,
  minDistance,
  maxDistance,
  autoRotate = false,
  className,
  children,
}: Props) {
  const webgl = useWebGL();
  const reduced = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      rootMargin: "120px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [webgl]);

  const rotating = autoRotate && !reduced && !touched;
  const frameloop = !visible ? "never" : rotating ? "always" : "demand";

  return (
    <div>
      {webgl ? (
        <div
          ref={wrap}
          role="img"
          aria-label={ariaLabel}
          className={cn(
            "relative h-[22rem] w-full touch-pan-y overflow-hidden rounded-lg border border-border sm:h-[30rem]",
            className,
          )}
          style={{
            background: `radial-gradient(120% 90% at 50% 0%, ${COLORS.card}, ${COLORS.background})`,
          }}
        >
          <Canvas
            dpr={[1, 2]}
            frameloop={frameloop}
            camera={{ position: camera.position, fov: camera.fov ?? 45, near: 0.1, far: 400 }}
            gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          >
            <ambientLight intensity={1.1} />
            <directionalLight position={[8, 14, 6]} intensity={2.2} />
            <directionalLight position={[-10, 6, -8]} intensity={0.6} color={COLORS.cyan} />
            {children}
            <FitCamera base={camera.position} target={target ?? [0, 0, 0]} />
            <Controls
              target={target}
              autoRotate={rotating}
              minDistance={minDistance}
              maxDistance={maxDistance}
              onInteract={() => setTouched(true)}
            />
          </Canvas>
          <p className="pointer-events-none absolute right-3 bottom-2 text-[11px] text-muted-foreground/80">
            Arrastra para girar · rueda o pellizco para acercar
          </p>
          <p className="sr-only">{summary}</p>
          {tip && <TipBox tip={tip} />}
        </div>
      ) : (
        <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          Tu navegador no tiene WebGL disponible, así que se muestra la versión
          en tabla de esta gráfica. {summary}
        </p>
      )}
      {legend && <div className="mt-3">{legend}</div>}
      <details className="group mt-3 text-sm" open={!webgl}>
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Ver los datos en tabla
        </summary>
        <div className="mt-2 max-h-72 overflow-auto rounded-md border border-border">
          {table}
        </div>
      </details>
    </div>
  );
}
