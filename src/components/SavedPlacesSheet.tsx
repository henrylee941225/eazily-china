import { useEffect, useState } from "react";
import { Drawer } from "@/components/ui/non-modal-drawer";
import { Bookmark, X } from "lucide-react";
import { toast } from "sonner";
import { useSavedPlaces, type SavedPlace } from "@/lib/savedPlaces";
import { getCategoryVisual } from "@/lib/categoryVisuals";

const SNAP_POINTS = [0.5, 0.95];

function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const R = 6371000;
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function formatDistance(m: number) {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userCoord: { latitude: number; longitude: number } | null;
  onSelect: (place: SavedPlace) => void;
};

export function SavedPlacesSheet({ open, onOpenChange, userCoord, onSelect }: Props) {
  const { savedPlaces, remove } = useSavedPlaces();
  const [snap, setSnap] = useState<number | string | null>(SNAP_POINTS[0]);

  useEffect(() => {
    if (open) setSnap(SNAP_POINTS[0]);
  }, [open]);

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    remove(id);
    toast("Removed from favourites", { duration: 2000 });
  };

  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      modal={false}
      snapPoints={SNAP_POINTS}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
    >
      <Drawer.Portal>
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-surface-elevated shadow-2xl outline-none"
          style={{ height: "95vh" }}
        >
          <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-border-strong" />
          <Drawer.Title className="sr-only">Saved Places</Drawer.Title>
          <Drawer.Description className="sr-only">
            Your bookmarked places saved on this device.
          </Drawer.Description>

          <div className="px-4 pt-3 flex items-start justify-between">
            <div>
              <h2 className="font-serif text-xl font-semibold text-ink">Saved Places</h2>
              <p className="text-sm text-ink-secondary mt-0.5">
                {savedPlaces.length} {savedPlaces.length === 1 ? "place" : "places"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className="h-9 w-9 rounded-full border border-border flex items-center justify-center"
            >
              <X className="h-4 w-4 text-ink-secondary" />
            </button>
          </div>

          <div className="mt-3 flex-1 overflow-y-auto">
            {savedPlaces.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center px-8 text-center py-16">
                <Bookmark className="h-20 w-20 text-border-strong" strokeWidth={1.5} />
                <h3 className="mt-4 font-serif text-lg font-semibold text-ink">
                  No saved places yet
                </h3>
                <p className="mt-2 text-sm text-ink-secondary leading-relaxed">
                  Tap the bookmark on any place to save it for later. Your saves are
                  stored on this device.
                </p>
              </div>
            ) : (
              <ul>
                {savedPlaces.map((p) => {
                  const visual = getCategoryVisual(p.category);
                  const Icon = visual.icon;
                  const distance =
                    userCoord != null
                      ? haversineMeters(userCoord, {
                          latitude: p.latitude,
                          longitude: p.longitude,
                        })
                      : null;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(p)}
                        className="w-full flex items-center gap-3 py-3 px-4 border-b border-border text-left active:bg-background transition-colors"
                      >
                        <div
                          className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center"
                          style={{ background: visual.color }}
                        >
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-ink truncate">
                            {p.name}
                          </p>
                          <p className="text-xs text-ink-secondary mt-0.5 truncate">
                            {[p.category, distance != null && `${formatDistance(distance)} away`]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleRemove(e, p.id)}
                          aria-label={`Remove ${p.name}`}
                          className="h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-ink-tertiary hover:text-ink-secondary hover:bg-background"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}