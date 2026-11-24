"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

let webglCache: boolean | null = null;
function detectWebGL(): boolean {
  if (webglCache !== null) return webglCache;
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") ?? c.getContext("webgl");
    webglCache = !!gl;
    (gl as WebGLRenderingContext | null)
      ?.getExtension("WEBGL_lose_context")
      ?.loseContext();
  } catch {
    webglCache = false;
  }
  return webglCache;
}

/** true si el navegador puede crear un contexto WebGL. */
export function useWebGL(): boolean {
  return useSyncExternalStore(noopSubscribe, detectWebGL, () => true);
}

/** true si el usuario pidió reducir el movimiento. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}
