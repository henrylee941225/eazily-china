export type GuideStep = {
  title: string;
  body: string;
  image: string;
};

type Props = {
  steps: GuideStep[];
  accentColor: string;
};

export const PaymentGuide = ({ steps, accentColor }: Props) => {
  return (
    <ol className="relative space-y-6">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-cream"
              style={{ background: accentColor }}
            >
              {i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className="my-2 w-px flex-1 bg-foreground/15" />
            )}
          </div>
          <div className="min-w-0 flex-1 pb-2">
            <h3 className="font-display text-lg text-ink">{s.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            <div className="mt-3 overflow-hidden rounded-xl border border-foreground/10 bg-muted/40">
              <img
                src={s.image}
                alt={s.title}
                loading="lazy"
                className="h-48 w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
};