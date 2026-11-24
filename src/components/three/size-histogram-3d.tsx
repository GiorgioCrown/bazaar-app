"use client";

import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { SceneFrame, type Tip } from "./scene-frame";
import { Label } from "./label";
import { COLORS, heat } from "../viz/theme";
import { edgesToBytes, fmtBytes, fmtInt } from "../viz/format";
import { DataTable } from "../viz/data-table";
import { HeatLegend } from "../viz/legend";

export type SizeHistogram3DProps = { edges: number[]; counts: number[] };

const W = 18;
const H = 6;
const DEPTH = 2.4;

function niceTicks(max: number): number[] {
  const mag = 10 ** Math.floor(Math.log10(max));
  const step =
    [1, 2, 5, 10].map((k) => k * mag).find((s) => max / s <= 4) ?? mag * 10;
  const out: number[] = [];
  for (let v = step; v <= max; v += step) out.push(v);
  return out;
}

type Bin = { lo: number; hi: number; n: number };

const Axes = memo(function Axes({ bins, max }: { bins: Bin[]; max: number }) {
  const step = W / bins.length;
  const every = Math.max(1, Math.ceil(bins.length / 7));
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[W + 1.5, DEPTH + 3]} />
        <meshBasicMaterial color={COLORS.card} />
      </mesh>
      {bins.map((b, i) =>
        i % every === 0 && i <= bins.length - Math.ceil(every / 2) ? (
          <Label
            key={i}
            text={fmtBytes(b.lo)}
            position={[-W / 2 + i * step, 0.05, DEPTH / 2 + 1.1]}
            color={COLORS.muted}
            height={0.6}
            weight={500}
          />
        ) : null,
      )}
      <Label
        text={fmtBytes(bins[bins.length - 1].hi)}
        position={[W / 2, 0.05, DEPTH / 2 + 1.1]}
        color={COLORS.muted}
        height={0.6}
        weight={500}
      />
      <Label
        text="Tamaño de archivo (escala log)"
        position={[0, 0.05, DEPTH / 2 + 3.4]}
        color={COLORS.amber}
        height={0.62}
      />
      {niceTicks(max).map((v) => {
        const y = (v / max) * H;
        return (
          <group key={v}>
            <Label
              text={fmtInt(v)}
              position={[-W / 2 - 1.1, y, -DEPTH / 2]}
              color={COLORS.muted}
              height={0.6}
              weight={500}
            />
            <lineSegments>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  args={[
                    new Float32Array([-W / 2, y, -DEPTH / 2, W / 2, y, -DEPTH / 2]),
                    3,
                  ]}
                />
              </bufferGeometry>
              <lineBasicMaterial color={COLORS.grid} transparent opacity={0.6} />
            </lineSegments>
          </group>
        );
      })}
      <Label
        text="Muestras"
        position={[-W / 2 + 0.6, H + 0.9, -DEPTH / 2]}
        color={COLORS.amber}
        height={0.62}
      />
    </group>
  );
});

function Bars({
  bins,
  max,
  onTip,
}: {
  bins: Bin[];
  max: number;
  onTip: (t: Tip | null) => void;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const [hover, setHover] = useState<number | null>(null);
  const step = W / bins.length;
  const total = useMemo(() => bins.reduce((s, b) => s + b.n, 0), [bins]);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    const white = new THREE.Color("#ffffff");
    bins.forEach((b, i) => {
      const h = b.n > 0 ? Math.max(0.08, (b.n / max) * H) : 0.03;
      o.position.set(-W / 2 + (i + 0.5) * step, h / 2, 0);
      o.scale.set(step * 0.86, h, DEPTH);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      c.set(b.n > 0 ? heat(b.n / max) : COLORS.grid);
      if (i === hover) c.lerp(white, 0.4);
      m.setColorAt(i, c);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    invalidate();
  }, [bins, max, step, hover, invalidate]);

  const tipFor = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    e.stopPropagation();
    const i = e.instanceId;
    if (i === undefined) return;
    const b = bins[i];
    setHover(i);
    onTip({
      x: e.clientX,
      y: e.clientY,
      title: `${fmtBytes(b.lo)} – ${fmtBytes(b.hi)}`,
      lines: [
        `${fmtInt(b.n)} muestras`,
        total ? `${((b.n / total) * 100).toFixed(1)} % del total` : "",
      ].filter(Boolean),
    });
  };

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, bins.length]}
      onPointerMove={tipFor}
      onClick={tipFor}
      onPointerOut={() => {
        setHover(null);
        onTip(null);
      }}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.5} metalness={0.1} />
    </instancedMesh>
  );
}

export function SizeHistogram3D({ edges, counts }: SizeHistogram3DProps) {
  const [tip, setTip] = useState<Tip | null>(null);
  const bins = useMemo<Bin[]>(() => {
    const e = edgesToBytes(edges);
    return counts.map((n, i) => ({ lo: e[i], hi: e[i + 1], n }));
  }, [edges, counts]);
  const max = useMemo(() => Math.max(1, ...counts), [counts]);

  if (bins.length < 1 || edges.length !== counts.length + 1) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin datos suficientes para el histograma.
      </p>
    );
  }
  const total = counts.reduce((s, v) => s + v, 0);
  const top = bins.reduce((b, x) => (x.n > b.n ? x : b), bins[0]);
  const summary = `Histograma 3D del tamaño de archivo con ${bins.length} intervalos logarítmicos entre ${fmtBytes(bins[0].lo)} y ${fmtBytes(bins[bins.length - 1].hi)}, ${fmtInt(total)} muestras. El intervalo más frecuente es ${fmtBytes(top.lo)} a ${fmtBytes(top.hi)} con ${fmtInt(top.n)} muestras.`;

  return (
    <SceneFrame
      ariaLabel={summary}
      summary={summary}
      tip={tip}
      camera={{ position: [-5, 7, 16], fov: 42 }}
      target={[0, 2, 0]}
      minDistance={8}
      maxDistance={45}
      legend={<HeatLegend min="0" max={fmtInt(max)} unit="muestras por intervalo" />}
      table={
        <DataTable
          caption="Muestras por intervalo de tamaño"
          head={["Intervalo", "Muestras", "% del total"]}
          rows={bins.map((b) => [
            `${fmtBytes(b.lo)} – ${fmtBytes(b.hi)}`,
            fmtInt(b.n),
            total ? `${((b.n / total) * 100).toFixed(1)} %` : "–",
          ])}
        />
      }
    >
      <Axes bins={bins} max={max} />
      <Bars bins={bins} max={max} onTip={setTip} />
    </SceneFrame>
  );
}
