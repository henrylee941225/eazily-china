import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Bookmark, Share2, AlertCircle, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import {
  getGuide,
  getNextGuide,
  getTopic,
} from "@/content/guides";
import { toast } from "sonner";

const SAVED_KEY = "ezc_saved_guides";
const SHARE_BASE_URL = "https://app.eazilychina.com";

const copyLink = async (url: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    const input = document.createElement("textarea");
    input.value = url;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand("copy");
    input.remove();
    return copied;
  }
};

const isShareCancelled = (error: unknown): boolean => {
  const value = error as { name?: string; message?: string } | null;
  return value?.name === "AbortError" || /cancel/i.test(value?.message ?? "");
};

const readSaved = (): string[] => {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
};

const GuideArticle = () => {
  const { topicSlug = "", guideSlug = "" } = useParams();
  const navigate = useNavigate();
  const guide = getGuide(topicSlug, guideSlug);
  const topic = getTopic(topicSlug);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(readSaved().includes(guideSlug));
  }, [guideSlug]);

  if (!guide || !topic) return <Navigate to="/guides" replace />;

  const next = getNextGuide(guide);

  const toggleSaved = () => {
    const current = readSaved();
    const isSaved = current.includes(guide.slug);
    const nextList = isSaved
      ? current.filter((s) => s !== guide.slug)
      : [...current, guide.slug];
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(nextList));
    } catch {
      /* noop */
    }
    setSaved(!isSaved);
    toast(isSaved ? "Removed from saved" : "Saved");
  };

  const handleShare = async () => {
    const url = `${SHARE_BASE_URL}/guides/${guide.topicSlug}/${guide.slug}`;
    const payload = { title: guide.title, text: guide.lede, url };
    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share(payload);
        return;
      }
      if (navigator.share) {
        await navigator.share(payload);
        return;
      }
    } catch (error) {
      if (isShareCancelled(error)) return;
    }
    try {
      toast(await copyLink(url) ? "Link copied" : "Couldn't share link");
    } catch {
      toast("Couldn't share link");
    }
  };

  return (
    <div className="min-h-screen bg-white pb-with-nav">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white pt-safe">
        <div className="mx-auto flex w-full max-w-[440px] items-center gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate(`/guides/${topic.slug}`)}
            aria-label="Back"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F6F6F7] text-ink transition-colors hover:bg-[#F3F3F4]"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={toggleSaved}
            aria-label={saved ? "Remove bookmark" : "Bookmark"}
            aria-pressed={saved}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F6F6F7] text-ink transition-colors hover:bg-[#F3F3F4]"
          >
            <Bookmark
              className="h-5 w-5"
              strokeWidth={2}
              fill={saved ? "currentColor" : "none"}
            />
          </button>
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F6F6F7] text-ink transition-colors hover:bg-[#F3F3F4]"
          >
            <Share2 className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[440px] px-5 pb-8">
        {/* Eyebrow */}
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">
          {topic.title} · {guide.readMinutes} min read
        </div>

        {/* Title + lede */}
        <h1 className="mt-2 text-[28px] font-extrabold leading-[1.15] text-ink">
          {guide.title}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-secondary">
          {guide.lede}
        </p>

        {/* Interactive checklist CTA — only on the pre-arrival checklist article */}
        {guide.slug === "pre-arrival-checklist" && (
          <Link
            to="/pretrip"
            className="mt-5 flex w-full items-center justify-between gap-3 rounded-full bg-[#0A0A0B] px-5 py-4 text-white transition active:opacity-90"
          >
            <span className="text-[15px] font-semibold">
              Track your progress — open your checklist
            </span>
            <ChevronRight className="h-5 w-5 shrink-0" strokeWidth={2} />
          </Link>
        )}

        {/* Callout */}
        {guide.callout && (
          <div
            className="mt-5 flex gap-3 rounded-2xl border-l-2 border-[#DE2910] p-4"
            style={{ background: "rgba(222, 41, 16, 0.07)" }}
          >
            <AlertCircle
              className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#DE2910]"
              strokeWidth={2}
            />
            <p className="text-[14px] leading-relaxed text-ink">
              {guide.callout.text}
            </p>
          </div>
        )}

        {/* Steps */}
        {guide.steps && guide.steps.length > 0 && (
          <ol className="mt-6 space-y-6">
            {guide.steps.map((s, i) => (
              <li key={i} className="flex gap-4">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0A0A0B] text-[13px] font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[16px] font-semibold leading-snug text-ink">
                    {s.title}
                  </div>
                  <p className="mt-1 text-[15px] leading-relaxed text-ink-secondary">
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}

        {/* Sections */}
        {guide.sections && guide.sections.length > 0 && (
          <div className="mt-6 space-y-6">
            {guide.sections.map((s, i) => (
              <section key={i}>
                <h2 className="text-[18px] font-semibold text-ink">
                  {s.heading}
                </h2>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-secondary">
                  {s.body}
                </p>
              </section>
            ))}
          </div>
        )}

        {/* Next guide */}
        {next && (
          <section className="mt-10">
            <div className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">
              Next guide
            </div>
            <Link
              to={`/guides/${next.topicSlug}/${next.slug}`}
              className="flex items-center gap-4 rounded-2xl bg-[#F6F6F7] px-4 py-4 transition active:bg-[#F3F3F4]"
            >
              <span className="w-7 shrink-0 text-[13px] font-semibold tabular-nums text-ink-tertiary">
                {String(next.order).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold leading-tight text-ink">
                  {next.title}
                </div>
                <div className="mt-0.5 text-[13px] text-ink-secondary">
                  {next.readMinutes} min
                </div>
              </div>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-ink-tertiary"
                strokeWidth={2}
              />
            </Link>
          </section>
        )}
      </main>
    </div>
  );
};

export default GuideArticle;
