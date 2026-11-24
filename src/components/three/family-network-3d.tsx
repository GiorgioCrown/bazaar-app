"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { SceneFrame, type Tip } from "./scene-frame";
import { Label } from "./label";
import { COLORS, SERIES } from "../viz/theme";
import { fmtInt } from "../viz/format";
import { DataTable } from "../viz/data-table";
import { Swatches } from "../viz/legend";

export type FamilyNetwork3DProps = {
  nodes: { id: string; count: number; group: string }[];
  links: { source: string; target: string; weight: number }[];
};

type Laid = { id: string; count: number; group: string; pos: THREE.Vector3; r: number; color: string };

/** Layout de fuerzas determinista (sin azar): esfera de Fibonacci + relajación. */
function layout(
  nodes: FamilyNetwork3DProps["nodes"],
  links: FamilyNetwork3DProps["links"],
): Laid[] {
  const n = nodes.length;
  const index = new Map(nodes.map((d, i) => [d.id, i]));
  const pos = nodes.map((_, i) => {
    const y = n === 1 ? 0 : 1 - (2 * i) / (n - 1);
    const rad = Math.sqrt(Math.max(0, 1 - y * y));
    const th = i * Math.PI * (3 - Math.sqrt(5));
    return new THREE.Vector3(Math.cos(th) * rad, y, Math.sin(th) * rad).multiplyScalar(6);
  });
  const maxW = Math.max(1, ...links.map((l) => l.weight));
  const edges = links
    .map((l) => ({ a: index.get(l.source), b: index.get(l.target), w: l.weight / maxW }))
    .filter((e): e is { a: number; b: number; w: number } => e.a !== undefined && e.b !== undefined);
  const d = new THREE.Vector3();
  for (let it = 0; it < 260; it++) {
    const cool = 1 - it / 260;
    const f = pos.map(() => new THREE.Vector3());
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        d.subVectors(pos[i], pos[j]);
        const dist = Math.max(0.3, d.length());
        d.normalize().multiplyScalar(14 / (dist * dist));
        f[i].add(d);
        f[j].sub(d);
      }
    }
    for (const e of edges) {
      d.subVectors(pos[e.b], pos[e.a]);
      const dist = d.length();
      const target = 8 - 5 * e.w;
      d.normalize().multiplyScalar((dist - target) * 0.04 * (0.4 + e.w));
      f[e.a].add(d);
      f[e.b].sub(d);
    }
    for (let i = 0; i < n; i++) {
      f[i].addScaledVector(pos[i], -0.012);
      pos[i].addScaledVector(f[i], 0.6 * cool + 0.05);
    }
  }
  // Reescala para que la nube quepa en un radio ~7.5.
  const maxR = Math.max(1, ...pos.map((p) => p.length()));
  pos.forEach((p) => p.multiplyScalar(7.5 / maxR));
  const maxC = Math.max(1, ...nodes.map((x) => x.count));
  const groups = [...new Set(nodes.map((x) => x.group))];
  return nodes.map((nd, i) => ({
    ...nd,
    pos: pos[i],
    r: 0.28 + Math.sqrt(nd.count / maxC) * 0.85,
    color: SERIES[groups.indexOf(nd.group) % SERIES.length],
  }));
}

function Scene({
  laid,
  links,
  onTip,
}: {
  laid: Laid[];
  links: FamilyNetwork3DProps["links"];
  onTip: (t: Tip | null) => void;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const [hover, setHover] = useState<string | null>(null);
  const byId = useMemo(() => new Map(laid.map((l) => [l.id, l])), [laid]);
  const edges = useMemo(
    () =>
      links
        .map((l) => ({ ...l, a: byId.get(l.source), b: byId.get(l.target) }))
        .filter((e) => e.a && e.b),
    [links, byId],
  );
  const maxW = Math.max(1, ...links.map((l) => l.weight));
  const lineGeo = useRef<THREE.BufferGeometry>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(edges.length * 6);
    edges.forEach((e, i) => {
      arr.set([e.a!.pos.x, e.a!.pos.y, e.a!.pos.z, e.b!.pos.x, e.b!.pos.y, e.b!.pos.z], i * 6);
    });
    return arr;
  }, [edges]);
  const colors = useMemo(() => new Float32Array(edges.length * 6), [edges]);

  useEffect(() => {
    const bg = new THREE.Color(COLORS.card);
    const base = new THREE.Color(COLORS.axis);
    const hot = new THREE.Color(COLORS.amber);
    const c = new THREE.Color();
    edges.forEach((e, i) => {
      const w = e.weight / maxW;
      const on = hover !== null && (e.source === hover || e.target === hover);
      if (on) c.copy(hot).lerp(bg, 0.5 - 0.5 * w);
      else c.copy(bg).lerp(base, (hover ? 0.15 : 0.25) + 0.6 * w);
      colors.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6);
    });
    const attr = lineGeo.current?.getAttribute("color") as THREE.BufferAttribute | undefined;
    if (attr) attr.needsUpdate = true;
    invalidate();
  }, [edges, hover, maxW, colors, invalidate]);

  const showLabel = (l: Laid, i: number) => laid.length <= 24 || i < 14 || l.id === hover;
  const order = useMemo(
    () => [...laid].sort((a, b) => b.count - a.count).map((l) => l.id),
    [laid],
  );

  const enter = (l: Laid, e: ThreeEvent<PointerEvent | MouseEvent>) => {
    e.stopPropagation();
    setHover(l.id);
    const mine = edges
      .filter((x) => x.source === l.id || x.target === l.id)
      .sort((a, b) => b.weight - a.weight);
    onTip({
      x: e.clientX,
      y: e.clientY,
      title: l.id,
      lines: [
        `${fmtInt(l.count)} muestras · grupo ${l.group}`,
        `${mine.length} conexiones`,
        ...mine
          .slice(0, 3)
          .map((x) => `${x.source === l.id ? x.target : x.source}: peso ${fmtInt(x.weight)}`),
      ],
    });
  };

  return (
    <group>
      <lineSegments>
        <bufferGeometry ref={lineGeo}>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors />
      </lineSegments>
      {laid.map((l) => (
        <group key={l.id}>
          <mesh
            position={l.pos}
            scale={l.id === hover ? 1.25 : 1}
            onPointerMove={(e) => enter(l, e)}
            onClick={(e) => enter(l, e)}
            onPointerOut={() => {
              setHover(null);
              onTip(null);
            }}
          >
            <sphereGeometry args={[l.r, 24, 18]} />
            <meshStandardMaterial
              color={l.color}
              roughness={0.4}
              metalness={0.15}
              emissive={l.color}
              emissiveIntensity={l.id === hover ? 0.55 : 0.12}
            />
          </mesh>
          {showLabel(l, order.indexOf(l.id)) && (
            <Label
              text={l.id}
              position={[l.pos.x, l.pos.y + l.r + 0.55, l.pos.z]}
              color={l.id === hover ? COLORS.amber : COLORS.text}
              height={0.5}
            />
          )}
        </group>
      ))}
    </group>
  );
}

export function FamilyNetwork3D({ nodes, links }: FamilyNetwork3DProps) {
  const [tip, setTip] = useState<Tip | null>(null);
  const laid = useMemo(() => layout(nodes, links), [nodes, links]);
  const groups = useMemo(
    () => [...new Set(nodes.map((n) => n.group))],
    [nodes],
  );

  if (nodes.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin suficientes familias para construir la red.
      </p>
    );
  }
  const topLinks = [...links].sort((a, b) => b.weight - a.weight).slice(0, 20);
  const summary = `Red 3D de co-ocurrencia con ${nodes.length} familias y ${links.length} conexiones. ${
    topLinks[0]
      ? `La conexión más fuerte une ${topLinks[0].source} con ${topLinks[0].target} (peso ${fmtInt(topLinks[0].weight)}).`
      : "No hay conexiones."
  }`;

  return (
    <SceneFrame
      ariaLabel={summary}
      summary={summary}
      tip={tip}
      camera={{ position: [0, 6, 20], fov: 45 }}
      target={[0, 0, 0]}
      minDistance={8}
      maxDistance={45}
      autoRotate
      legend={
        <div className="space-y-1">
          <Swatches
            items={groups.map((g, i) => ({
              color: SERIES[i % SERIES.length],
              label: `Grupo ${g}`,
            }))}
          />
          <p className="text-xs text-muted-foreground">
            Tamaño de la esfera ∝ √muestras · línea más clara = mayor peso.
          </p>
        </div>
      }
      table={
        <DataTable
          caption="Conexiones más fuertes entre familias"
          head={["Familia A", "Familia B", "Peso"]}
          rows={topLinks.map((l) => [l.source, l.target, fmtInt(l.weight)])}
        />
      }
    >
      <Scene laid={laid} links={links} onTip={setTip} />
    </SceneFrame>
  );
}
