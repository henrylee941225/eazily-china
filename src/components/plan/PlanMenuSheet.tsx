import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Pencil, Share2, Trash2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEdit: () => void;
  onShare: () => void;
  onDelete: () => void;
};

export const PlanMenuSheet = ({ open, onOpenChange, onEdit, onShare, onDelete }: Props) => {
  const close = () => onOpenChange(false);
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-[440px] rounded-t-3xl border-t border-border bg-white">
        <div className="px-2 pb-4 pt-2">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-border" aria-hidden />
          <ul className="divide-y divide-border">
            <li>
              <button
                type="button"
                onClick={() => { close(); onEdit(); }}
                className="flex w-full items-center gap-3 px-4 py-4 text-left text-[15px] font-medium text-ink transition-colors hover:bg-surface-2"
              >
                <Pencil className="h-4 w-4" strokeWidth={1.9} />
                Edit day
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => { close(); onShare(); }}
                className="flex w-full items-center gap-3 px-4 py-4 text-left text-[15px] font-medium text-ink transition-colors hover:bg-surface-2"
              >
                <Share2 className="h-4 w-4" strokeWidth={1.9} />
                Share this day
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => { close(); onDelete(); }}
                className="flex w-full items-center gap-3 px-4 py-4 text-left text-[15px] font-medium text-[hsl(var(--brand-red))] transition-colors hover:bg-[hsl(var(--error-tint))]"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.9} />
                Delete this day
              </button>
            </li>
          </ul>
          <button
            type="button"
            onClick={close}
            className="mt-3 flex h-12 w-full items-center justify-center rounded-full bg-surface-2 text-[15px] font-semibold text-ink"
          >
            Cancel
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default PlanMenuSheet;