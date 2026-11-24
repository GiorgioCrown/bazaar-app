"use client";

import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16">
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>Algo salió mal al mostrar esta página</AlertTitle>
        <AlertDescription>
          Verifica que la API esté corriendo (`npm run api`) e inténtalo de nuevo.
        </AlertDescription>
      </Alert>
      <Button className="mt-4" onClick={reset}>
        Reintentar
      </Button>
    </main>
  );
}
