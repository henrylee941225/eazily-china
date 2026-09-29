import * as React from "react";
import { DismissableLayerBranch } from "@radix-ui/react-dismissable-layer";
import { Drawer as VaulDrawer } from "vaul";

/**
 * Non-modal-by-default Vaul drawer wrapper.
 *
 * Vaul defaults to `modal={true}`, which renders an invisible overlay that
 * intercepts every tap outside the sheet. On the map page this makes the
 * bottom nav, search bar, and map controls unresponsive whenever a drawer is
 * open. This wrapper flips the default to `modal={false}`; callers can opt
 * back into modal behaviour explicitly with `modal={true}`.
 */
const Root = ({
  modal = false,
  open,
  ...props
}: React.ComponentProps<typeof VaulDrawer.Root>) => {
  React.useEffect(() => {
    if (modal || !open) return;

    const unlockOutsideInteractions = () => {
      document.body.style.pointerEvents = "auto";
    };

    unlockOutsideInteractions();
    const raf = window.requestAnimationFrame(unlockOutsideInteractions);
    const timeout = window.setTimeout(unlockOutsideInteractions, 60);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
  }, [modal, open]);

  return <VaulDrawer.Root modal={modal} open={open} {...props} />;
};

export const Drawer = {
  Root,
  Trigger: VaulDrawer.Trigger,
  Portal: VaulDrawer.Portal,
  Overlay: VaulDrawer.Overlay,
  Content: VaulDrawer.Content,
  Title: VaulDrawer.Title,
  Description: VaulDrawer.Description,
  Close: VaulDrawer.Close,
  Handle: VaulDrawer.Handle,
  NestedRoot: VaulDrawer.NestedRoot,
  Branch: DismissableLayerBranch,
};

export const DrawerRoot = Root;
export const DrawerTrigger = VaulDrawer.Trigger;
export const DrawerPortal = VaulDrawer.Portal;
export const DrawerOverlay = VaulDrawer.Overlay;
export const DrawerContent = VaulDrawer.Content;
export const DrawerTitle = VaulDrawer.Title;
export const DrawerDescription = VaulDrawer.Description;
export const DrawerClose = VaulDrawer.Close;
export const DrawerBranch = DismissableLayerBranch;