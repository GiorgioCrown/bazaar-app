"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useReducedMotion, useWebGL } from "./use-env";
import { COLORS } from "../viz/theme";

// Generador pseudoaleatorio determinista (mulberry32): mismo campo en cada carga.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Field({ count, animate }: { count: number; animate: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const { positions, colors } = useMemo(() => {
    const r = rng(7);
    const p = new Float32Array(count * 3);
    const c = new Float32Array(count * 3);
    const palette = [COLORS.amber, COLORS.cyan, COLORS.muted].map((h) => new THREE.Color(h));
    for (let i = 0; i < count; i++) {
      p[i * 3] = (r() - 0.5) * 22;
      p[i * 3 + 1] = (r() - 0.5) * 9;
      p[i * 3 + 2] = (r() - 0.5) * 10;
      const col = palette[r() < 0.18 ? 0 : r() < 0.5 ? 1 : 2];
      const k = 0.35 + r() * 0.5;
      c.set([col.r * k, col.g * k, col.b * k], i * 3);
    }
    return { positions: p, colors: c };
  }, [count]);

  useFrame((_, dt) => {
    if (animate && ref.current) {
      ref.current.rotation.y += dt * 0.025;
      ref.current.rotation.x = Math.sin(performance.now() / 12000) * 0.06;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.07}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.9}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/**
 * Capa de partículas sutil y decorativa (aria-hidden) que se posiciona absoluta
 * dentro de un contenedor relativo. Sin movimiento con prefers-reduced-motion;
 * se pausa fuera de pantalla; sin WebGL no dibuja nada.
 */
export function ParticleField({ count = 900 }: { count?: number }) {
  const webgl = useWebGL();
  const reduced = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [webgl]);

  if (!webgl) return null;
  const animate = !reduced;
  return (
    <div
      ref={wrap}
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10"
    >
      <Canvas
        dpr={[1, 1.5]}
        frameloop={!visible ? "never" : animate ? "always" : "demand"}
        camera={{ position: [0, 0, 9], fov: 55 }}
        gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
      >
        <Field count={count} animate={animate} />
      </Canvas>
    </div>
  );
}
