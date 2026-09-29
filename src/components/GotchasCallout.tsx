import { AlertTriangle } from "lucide-react";

type Props = {
  items: string[];
};

export const GotchasCallout = ({ items }: Props) => {
  return (
    <div className="rounded-2xl border border-vermilion/25 bg-vermilion/5 p-4">
      <div className="flex items-center gap-2 text-vermilion">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-[11px] font-bold uppercase tracking-[0.18em]">Common gotchas</span>
      </div>
      <ul className="mt-2 space-y-1.5 text-sm text-ink/85">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-vermilion" />
            <span className="leading-relaxed">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};