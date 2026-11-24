import "server-only";
import type { Viz } from "@/lib/api-types";

const API_URL = process.env.API_URL ?? "http://127.0.0.1:8000";

export class VizApiError extends Error {}

/** GET /api/viz?hours=… (sección 13). Lanza `VizApiError` con mensaje legible. */
export async function getViz(hours: number): Promise<Viz> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/viz?hours=${hours}`, {
      next: { revalidate: 300, tags: ["bazaar"] },
    });
  } catch {
    throw new VizApiError(
      `No se pudo conectar con la API en ${API_URL}. Inicia el servicio con "npm run api".`,
    );
  }
  if (!res.ok) {
    throw new VizApiError(`La API respondió ${res.status} al pedir /api/viz.`);
  }
  return (await res.json()) as Viz;
}
