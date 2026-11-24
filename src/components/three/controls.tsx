"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

type Props = {
  target?: [number, number, number];
  autoRotate?: boolean;
  minDistance?: number;
  maxDistance?: number;
  onInteract?: () => void;
};

/** OrbitControls con amortiguación; invalida el frame bajo demanda. */
export function Controls({
  target = [0, 0, 0],
  autoRotate = false,
  minDistance = 4,
  maxDistance = 60,
  onInteract,
}: Props) {
  const { camera, gl, invalidate } = useThree();
  const ref = useRef<OrbitControls | null>(null);
  const interact = useRef(onInteract);
  useEffect(() => {
    interact.current = onInteract;
  });

  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement);
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.rotateSpeed = 0.7;
    c.zoomSpeed = 0.8;
    c.enablePan = false;
    c.maxPolarAngle = Math.PI * 0.49;
    c.minDistance = minDistance;
    c.maxDistance = maxDistance;
    c.target.set(...target);
    c.autoRotateSpeed = 0.6;
    // Deja que el scroll vertical de la página funcione con el dedo sobre la escena.
    if (c.domElement) c.domElement.style.touchAction = "pan-y";
    const onChange = () => invalidate();
    const onStart = () => interact.current?.();
    c.addEventListener("change", onChange);
    c.addEventListener("start", onStart);
    c.update();
    ref.current = c;
    return () => {
      c.removeEventListener("change", onChange);
      c.removeEventListener("start", onStart);
      c.dispose();
      ref.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl, invalidate, minDistance, maxDistance]);

  useEffect(() => {
    if (ref.current) ref.current.autoRotate = autoRotate;
    invalidate();
  }, [autoRotate, invalidate]);

  useFrame(() => ref.current?.update());
  return null;
}
