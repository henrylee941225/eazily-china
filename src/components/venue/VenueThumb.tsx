import { useState } from "react";
import type { VenueImage } from "@/lib/venueImages";

/**
 * 16:9 directory thumbnail. Renders nothing at all when the venue has no
 * image, so text-only cards keep the same width and padding.
 */
export const VenueThumb = ({
  image,
  name,
}: {
  image?: VenueImage;
  name: string;
}) => {
  const [failed, setFailed] = useState(false);
  const showImage = !!image && !failed;

  // No image is a normal state: the element is omitted so the card collapses
  // to text-only rather than reserving an empty frame.
  if (!showImage) return null;

  return (
    <div className="relative mb-3 w-full overflow-hidden rounded-2xl bg-[#F6F6F7] [aspect-ratio:16/9]">
      <img
          src={image!.url}
          alt={name}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
    </div>
  );
};
