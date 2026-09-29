import { useMemo } from "react";
import { Navigate, useParams } from "react-router-dom";
import { ScreenHeader } from "@/components/ScreenHeader";
import {
  PRIVACY_POLICY,
  TERMS_AND_CONDITIONS,
  COOKIES_POLICY,
  type LegalDocument,
  type LegalSection,
} from "@/content/legal";

const DOCS: Record<string, LegalDocument> = {
  privacy: PRIVACY_POLICY,
  terms: TERMS_AND_CONDITIONS,
  cookies: COOKIES_POLICY,
};

const renderSection = (section: LegalSection, idx: number) => {
  const nodes: React.ReactNode[] = [];
  if (section.heading) {
    nodes.push(
      <h2
        key={`h-${idx}`}
        className="font-display mt-8 text-[20px] font-semibold leading-snug text-ink"
      >
        {section.heading}
      </h2>,
    );
  }
  if (section.subheading) {
    nodes.push(
      <h3
        key={`sh-${idx}`}
        className="mt-5 text-[16px] font-semibold leading-snug text-ink"
      >
        {section.subheading}
      </h3>,
    );
  }

  // Group consecutive bullet items into a single <ul>.
  const chunks: { type: "p" | "ul"; items: string[] }[] = [];
  for (const p of section.paragraphs) {
    const isBullet = p.startsWith("- ");
    const last = chunks[chunks.length - 1];
    if (isBullet) {
      const text = p.slice(2);
      if (last && last.type === "ul") last.items.push(text);
      else chunks.push({ type: "ul", items: [text] });
    } else {
      chunks.push({ type: "p", items: [p] });
    }
  }

  chunks.forEach((chunk, cIdx) => {
    if (chunk.type === "p") {
      nodes.push(
        <p
          key={`p-${idx}-${cIdx}`}
          className="mt-4 text-[15px] leading-[1.7] text-ink/90"
        >
          {chunk.items[0]}
        </p>,
      );
    } else {
      nodes.push(
        <ul
          key={`ul-${idx}-${cIdx}`}
          className="mt-3 list-disc space-y-2 pl-6 text-[15px] leading-[1.7] text-ink/90 marker:text-ink-tertiary"
        >
          {chunk.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>,
      );
    }
  });

  return <section key={idx}>{nodes}</section>;
};

export default function LegalPage() {
  const { slug } = useParams<{ slug: string }>();
  const doc = slug ? DOCS[slug] : undefined;
  const content = useMemo(() => doc?.sections.map(renderSection), [doc]);

  if (!doc) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-white">
      <ScreenHeader title={doc.title} showBack backTo="/account" />
      <main className="mx-auto max-w-[680px] px-5 pb-16 pt-4 font-sans text-ink">
        <h1 className="font-display text-[28px] font-extrabold leading-[1.15] text-ink">
          {doc.title}
        </h1>
        <p className="mt-2 text-[13px] text-ink-secondary">
          Last updated {doc.lastUpdated}
        </p>
        <div className="mt-6">{content}</div>
      </main>
    </div>
  );
}