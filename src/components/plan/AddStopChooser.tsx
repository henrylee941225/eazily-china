import { Sparkles, Pencil, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onAiSuggest: () => void;
  onManual: () => void;
};

export const AddStopChooser = ({ open, loading, onClose, onAiSuggest, onManual }: Props) => {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && !loading && onClose()}>
      <DialogContent className="max-w-md gap-0 rounded-3xl border-foreground/10 bg-card p-0 sm:rounded-3xl">
        <div className="flex items-center justify-between px-5 pt-5">
          <DialogTitle className="font-serif text-[20px] font-normal text-ink">
            Add a stop
          </DialogTitle>
        </div>

        <div className="px-5 py-4">
          {loading ? (
            <div
              className="flex flex-col items-center justify-center gap-3 py-10"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="h-6 w-6 animate-spin text-vermilion" aria-hidden />
              <div className="text-[14px] text-muted-foreground">Finding a stop…</div>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={onAiSuggest}
                className="flex w-full items-start gap-3 rounded-2xl border border-foreground/10 bg-background p-4 text-left transition-colors hover:bg-foreground/5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-vermilion/10 text-vermilion">
                  <Sparkles className="h-5 w-5" />
                </span>
                <span className="flex-1">
                  <span className="block font-display text-[16px] font-bold text-ink">
                    AI suggest
                  </span>
                  <span className="mt-0.5 block text-[13px] text-muted-foreground">
                    We'll find a stop that fits your day
                  </span>
                </span>
              </button>

              <button
                onClick={onManual}
                className="flex w-full items-start gap-3 rounded-2xl border border-foreground/10 bg-background p-4 text-left transition-colors hover:bg-foreground/5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-ink">
                  <Pencil className="h-5 w-5" />
                </span>
                <span className="flex-1">
                  <span className="block font-display text-[16px] font-bold text-ink">
                    Add manually
                  </span>
                  <span className="mt-0.5 block text-[13px] text-muted-foreground">
                    Type in a place yourself
                  </span>
                </span>
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};