import { useRef, useState } from "react";
import type { VenueImage } from "@/lib/venueImages";

/**
 * 4:3 full-bleed venue gallery. Horizontal snap scroll with dots when there is
 * more than one image; a single image renders as a static hero. The aspect
 * ratio is reserved in CSS so nothing reflows as images load.
 */
export const VenueGallery = ({
  images,
  name,
}: {
  images: VenueImage[];
  name: string;
}) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  // No imagery is a normal state: omit the hero entirely and let the detail
  // sheet open on the venue name.
  if (images.length === 0 || failed) return null;

  if (images.length === 1) {
    return (
      <div className="relative -mx-5 mb-4 w-[calc(100%+2.5rem)] overflow-hidden bg-[#F6F6F7] [aspect-ratio:4/3]">
        <img
          src={images[0].url}
          alt={name}
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    );
  }

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    if (next !== index) setIndex(next);
  };

  return (
    <div className="relative -mx-5 mb-4 w-[calc(100%+2.5rem)]">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((img) => (
          <div
            key={img.path}
            className="relative w-full shrink-0 snap-center bg-[#F6F6F7] [aspect-ratio:4/3]"
          >
            <img
              src={img.url}
              alt={name}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
        {images.map((img, i) => (
          <span
            key={img.path}
            className={`h-1.5 w-1.5 rounded-full transition ${
              i === index ? "bg-white" : "bg-white/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
};
