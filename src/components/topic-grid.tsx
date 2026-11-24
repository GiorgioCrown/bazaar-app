import Link from "next/link";
import { ArrowRight } from "lucide-react";

const TOPICS = [
  { n: "5", href: "/combinatoria", title: "Análisis combinatorio", text: "Perfiles familia × tipo × entrega, rankings y pares de tags." },
  { n: "6–7", href: "/estadistica", title: "Descriptiva y posición", text: "Media, mediana, moda, desviación, cuartiles, deciles y boxplot." },
  { n: "8–10", href: "/probabilidad", title: "Probabilidad", text: "Axiomas, independencia con χ² y probabilidad condicional." },
  { n: "11", href: "/bayes", title: "Teorema de Bayes", text: "Laboratorio: elige evidencias y mira cómo cambia la familia más probable." },
  { n: "12", href: "/variables", title: "Variables aleatorias", text: "X (Poisson), Y (lognormal) y Z, con E y Var." },
  { n: "13", href: "/visualizacion", title: "Visualización 3D", text: "Terreno de familias × horas, histograma 3D y red de co-ocurrencia." },
];

export function TopicGrid() {
  return (
    <nav aria-label="Temas del análisis">
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOPICS.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              className="group flex h-full flex-col gap-1 rounded-lg border border-border bg-background/40 p-4 transition-colors hover:border-primary"
            >
              <span className="font-heading text-sm font-semibold uppercase tracking-widest text-primary">
                Tema {t.n}
              </span>
              <span className="font-heading text-xl font-semibold">{t.title}</span>
              <span className="text-sm text-muted-foreground">{t.text}</span>
              <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm text-primary">
                Abrir <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
