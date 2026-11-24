"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";

type Props = {
  text: string;
  position: [number, number, number];
  color?: string;
  /** Alto del rótulo en unidades de escena. */
  height?: number;
  weight?: number;
};

function makeTexture(text: string, color: string, weight: number) {
  const family =
    getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  const px = 64;
  const font = `${weight} ${px}px ${family}`;
  const probe = document.createElement("canvas").getContext("2d")!;
  probe.font = font;
  const w = Math.ceil(probe.measureText(text).width) + 24;
  const h = px + 24;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 10;
  ctx.strokeStyle = "rgba(14,17,22,0.85)";
  ctx.strokeText(text, w / 2, h / 2 + 2);
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, aspect: w / h };
}

/** Rótulo de texto como sprite de canvas propio (sin fuentes ni assets remotos). */
export function Label({
  text,
  position,
  color = "#e5e8ec",
  height = 0.55,
  weight = 600,
}: Props) {
  const { tex, aspect } = useMemo(
    () => makeTexture(text, color, weight),
    [text, color, weight],
  );
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <sprite
      position={position}
      scale={[height * aspect, height, 1]}
      renderOrder={10}
    >
      <spriteMaterial
        map={tex}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </sprite>
  );
}
