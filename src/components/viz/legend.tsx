import { HEAT_STOPS } from "./theme";

export function HeatLegend({
  min,
  max,
  unit,
}: {
  min: string;
  max: string;
  unit: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <span>{min}</span>
      <span
        aria-hidden
        className="h-2.5 w-40 rounded-full"
        style={{ background: `linear-gradient(90deg, ${HEAT_STOPS.join(", ")})` }}
      />
      <span>
        {max} <span className="text-muted-foreground/70">{unit}</span>
      </span>
    </div>
  );
}

export function Swatches({
  items,
}: {
  items: { color: string; label: string }[];
}) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{ background: i.color }}
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
