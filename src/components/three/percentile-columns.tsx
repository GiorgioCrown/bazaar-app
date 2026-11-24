"use client";

import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { SceneFrame, type Tip } from "./scene-frame";
import { Label } from "./label";
import { COLORS } from "../viz/theme";
import { fmtBytes } from "../viz/format";
import { DataTable } from "../viz/data-table";
import { Swatches } from "../viz/legend";

export type PercentileColumnsProps = {
  curve: { p: number; value: number }[];
};

const KEY = [25, 50, 75, 90, 99];
const R = 6;
const HMAX = 5;
const HMIN = 0.3;

function lerpColor(a: string, b: string, t: number) {
  return new THREE.Color(a).lerp(new THREE.Color(b), t);
}

type Col = { p: number; value: number; h: number; angle: number };

const Marks = memo(function Marks({ cols }: { cols: Col[] }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[R + 3.2, 72]} />
        <meshBasicMaterial color={COLORS.card} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[R - 0.02, R + 0.02, 96]} />
        <meshBasicMaterial color={COLORS.grid} />
      </mesh>
      {cols
        .filter((c) => KEY.includes(c.p))
        .map((c) => {
          const r = R + 1.2;
          return (
            <Label
              key={c.p}
              text={`P${c.p} · ${fmtBytes(c.value)}`}
              position={[
                Math.sin(c.angle) * r,
                c.h + 0.6,
                Math.cos(c.angle) * r,
              ]}
              color={COLORS.amber}
              height={0.42}
            />
          );
        })}
      <Label
        text="Percentiles de tamaño"
        position={[0, 0.1, 0]}
        color={COLORS.muted}
        height={0.55}
        weight={500}
      />
    </group>
  );
});

function Columns({
  cols,
  onTip,
}: {
  cols: Col[];
  onTip: (t: Tip | null) => void;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const [hover, setHover] = useState<number | null>(null);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const white = new THREE.Color("#ffffff");
    cols.forEach((c, i) => {
      o.position.set(Math.sin(c.angle) * R, c.h / 2, Math.cos(c.angle) * R);
      o.rotation.set(0, c.angle, 0);
      o.scale.set(0.2, c.h, 0.5);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      const col = KEY.includes(c.p)
        ? new THREE.Color(COLORS.amber)
        : lerpColor(COLORS.cyan, COLORS.violet, c.p / 99);
      if (i === hover) col.lerp(white, 0.45);
      m.setColorAt(i, col);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    invalidate();
  }, [cols, hover, invalidate]);

  const tipFor = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    e.stopPropagation();
    const i = e.instanceId;
    if (i === undefined) return;
    const c = cols[i];
    setHover(i);
    onTip({
      x: e.clientX,
      y: e.clientY,
      title: `Percentil ${c.p}`,
      lines: [
        `${fmtBytes(c.value)} (${c.value.toLocaleString("es-MX")} bytes)`,
        `${c.p} % de las muestras pesa esto o menos`,
      ],
    });
  };

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, cols.length]}
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

export function PercentileColumns({ curve }: PercentileColumnsProps) {
  const [tip, setTip] = useState<Tip | null>(null);
  const cols = useMemo<Col[]>(() => {
    const vals = curve.map((c) => Math.max(1, c.value));
    const lo = Math.log10(Math.min(...vals));
    const hi = Math.log10(Math.max(...vals));
    const span = hi - lo || 1;
    return curve.map((c, i) => ({
      p: c.p,
      value: c.value,
      h: HMIN + ((Math.log10(vals[i]) - lo) / span) * (HMAX - HMIN),
      // P1 arriba y sentido horario; deja un hueco al final del anillo
      angle: (i / curve.length) * Math.PI * 2 * 0.96,
    }));
  }, [curve]);

  if (curve.length < 5) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin datos suficientes para los percentiles.
      </p>
    );
  }
  const key = curve.filter((c) => KEY.includes(c.p));
  const summary = `Anillo 3D de percentiles del tamaño de archivo (altura en escala logarítmica). ${key
    .map((c) => `P${c.p}: ${fmtBytes(c.value)}`)
    .join(", ")}.`;

  return (
    <SceneFrame
      ariaLabel={summary}
      summary={summary}
      tip={tip}
      camera={{ position: [0, 8, 14.5], fov: 42 }}
      target={[0, 1.8, 0]}
      minDistance={8}
      maxDistance={40}
      autoRotate
      legend={
        <Swatches
          items={[
            { color: COLORS.amber, label: "P25, P50, P75, P90 y P99" },
            { color: COLORS.cyan, label: "Percentiles bajos" },
            { color: COLORS.violet, label: "Percentiles altos" },
          ]}
        />
      }
      table={
        <DataTable
          caption="Percentiles destacados del tamaño de archivo"
          head={["Percentil", "Tamaño", "Bytes"]}
          rows={key.map((c) => [
            `P${c.p}`,
            fmtBytes(c.value),
            c.value.toLocaleString("es-MX"),
          ])}
        />
      }
    >
      <Marks cols={cols} />
      <Columns cols={cols} onTip={setTip} />
    </SceneFrame>
  );
}
