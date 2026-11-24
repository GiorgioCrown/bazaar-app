"use client";

import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { SceneFrame, type Tip } from "./scene-frame";
import { Label } from "./label";
import { COLORS, heat } from "../viz/theme";
import { fmtHour, fmtInt } from "../viz/format";
import { DataTable } from "../viz/data-table";
import { HeatLegend } from "../viz/legend";

export type FamilyTerrainProps = {
  families: string[];
  hours: string[];
  matrix: number[][]; // [familia][hora]
};

const W = 16; // ancho (eje de horas)
const D = 8; // profundidad (eje de familias)
const H = 5; // altura máxima

function Bars({
  families,
  hours,
  matrix,
  max,
  onTip,
}: FamilyTerrainProps & { max: number; onTip: (t: Tip | null) => void }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const [hover, setHover] = useState<number | null>(null);
  const nF = families.length;
  const nH = hours.length;
  const stepX = W / Math.max(nH, 1);
  const stepZ = D / Math.max(nF, 1);
  const hourTotals = useMemo(
    () => hours.map((_, j) => matrix.reduce((s, row) => s + (row[j] ?? 0), 0)),
    [hours, matrix],
  );

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    const white = new THREE.Color("#ffffff");
    for (let i = 0; i < nF; i++) {
      for (let j = 0; j < nH; j++) {
        const v = matrix[i]?.[j] ?? 0;
        const h = v > 0 ? Math.max(0.06, Math.sqrt(v / max) * H) : 0.03;
        const idx = i * nH + j;
        o.position.set(
          -W / 2 + (j + 0.5) * stepX,
          h / 2,
          -D / 2 + (i + 0.5) * stepZ,
        );
        o.scale.set(stepX * 0.82, h, stepZ * 0.72);
        o.updateMatrix();
        m.setMatrixAt(idx, o.matrix);
        c.set(v > 0 ? heat(Math.sqrt(v / max)) : COLORS.grid);
        if (idx === hover) c.lerp(white, 0.45);
        m.setColorAt(idx, c);
      }
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    invalidate();
  }, [matrix, max, nF, nH, stepX, stepZ, hover, invalidate]);

  const tipFor = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    e.stopPropagation();
    const id = e.instanceId;
    if (id === undefined) return;
    const i = Math.floor(id / nH);
    const j = id % nH;
    const v = matrix[i]?.[j] ?? 0;
    const tot = hourTotals[j] || 0;
    setHover(id);
    onTip({
      x: e.clientX,
      y: e.clientY,
      title: families[i],
      lines: [
        fmtHour(hours[j]),
        `${fmtInt(v)} muestras`,
        tot ? `${((v / tot) * 100).toFixed(1)} % de esa hora` : "Hora sin muestras",
      ],
    });
  };
  const clear = () => {
    setHover(null);
    onTip(null);
  };

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, nF * nH]}
      onPointerMove={tipFor}
      onClick={tipFor}
      onPointerOut={clear}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.55} metalness={0.1} />
    </instancedMesh>
  );
}

function niceTicks(max: number): number[] {
  const mag = 10 ** Math.floor(Math.log10(max));
  const step =
    [1, 2, 5, 10].map((k) => k * mag).find((s) => max / s <= 4) ?? mag * 10;
  const out: number[] = [];
  for (let v = step; v <= max; v += step) out.push(v);
  return out;
}

const Axes = memo(function Axes({
  families,
  hours,
  max,
}: {
  families: string[];
  hours: string[];
  max: number;
}) {
  const nH = hours.length;
  const nF = families.length;
  const stepX = W / Math.max(nH, 1);
  const stepZ = D / Math.max(nF, 1);
  const every = Math.max(1, Math.ceil(nH / 8));
  const ticks = niceTicks(max);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[W + 1, D + 1]} />
        <meshBasicMaterial color={COLORS.card} />
      </mesh>
      <gridHelper
        args={[W + 1, W + 1, COLORS.grid, COLORS.grid]}
        scale={[1, 1, (D + 1) / (W + 1)]}
      />
      {families.map((f, i) => (
        <Label
          key={f}
          text={f.length > 16 ? f.slice(0, 15) + "…" : f}
          position={[-W / 2 - 1.8, 0.2, -D / 2 + (i + 0.5) * stepZ]}
          color={i === 0 ? COLORS.amber : COLORS.text}
          height={0.52}
        />
      ))}
      {hours.map((h, j) =>
        j % every === 0 ? (
          <Label
            key={h}
            text={fmtHour(h)}
            position={[-W / 2 + (j + 0.5) * stepX, 0.1, D / 2 + 0.9]}
            color={COLORS.muted}
            height={0.5}
            weight={500}
          />
        ) : null,
      )}
      {ticks.map((v) => {
        const y = Math.sqrt(v / max) * H;
        return (
          <group key={v}>
            <Label
              text={fmtInt(v)}
              position={[W / 2 + 1.1, y, -D / 2]}
              color={COLORS.muted}
              height={0.6}
              weight={500}
            />
            <lineSegments>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  args={[
                    new Float32Array([-W / 2, y, -D / 2, W / 2, y, -D / 2]),
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
        text="Muestras (altura ∝ √conteo)"
        position={[W / 2 + 1.1, H + 0.9, -D / 2]}
        color={COLORS.amber}
        height={0.6}
      />
      <Label
        text="Hora (UTC)"
        position={[0, 0.1, D / 2 + 2]}
        color={COLORS.amber}
        height={0.6}
      />
    </group>
  );
});

export function FamilyTerrain({ families, hours, matrix }: FamilyTerrainProps) {
  const [tip, setTip] = useState<Tip | null>(null);
  const max = useMemo(() => Math.max(1, ...matrix.flat()), [matrix]);

  const stats = useMemo(
    () =>
      families.map((f, i) => {
        const row = matrix[i] ?? [];
        const total = row.reduce((s, v) => s + v, 0);
        const peak = row.reduce((b, v, j) => (v > row[b] ? j : b), 0);
        return { f, total, peak: hours[peak] ?? "", peakV: row[peak] ?? 0 };
      }),
    [families, hours, matrix],
  );

  if (!families.length || !hours.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin datos suficientes para el terreno.
      </p>
    );
  }

  const summary = `Terreno 3D de ${families.length} familias por ${hours.length} horas. Máximo: ${fmtInt(max)} muestras en una celda. ${stats
    .map((s) => `${s.f}: ${fmtInt(s.total)} en total`)
    .join("; ")}.`;

  return (
    <SceneFrame
      ariaLabel={`Terreno 3D: muestras de malware por familia y hora. ${summary}`}
      summary={summary}
      tip={tip}
      camera={{ position: [-14.5, 11.5, 15.5], fov: 42 }}
      target={[0, 1.2, 0]}
      minDistance={8}
      maxDistance={50}
      legend={<HeatLegend min="0" max={fmtInt(max)} unit="muestras en la celda" />}
      table={
        <DataTable
          caption="Muestras por familia: total y hora pico"
          head={["Familia", "Total", "Hora pico", "Muestras en el pico"]}
          rows={stats.map((s) => [
            s.f,
            fmtInt(s.total),
            fmtHour(s.peak),
            fmtInt(s.peakV),
          ])}
        />
      }
    >
      <Axes families={families} hours={hours} max={max} />
      <Bars
        families={families}
        hours={hours}
        matrix={matrix}
        max={max}
        onTip={setTip}
      />
    </SceneFrame>
  );
}
