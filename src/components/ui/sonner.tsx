import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      duration={2500}
      closeButton
      swipeDirections={["left", "right", "bottom"]}
      toastOptions={{
        duration: 2500,
        closeButton: true,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-ink group-[.toaster]:text-white group-[.toaster]:border-transparent group-[.toaster]:rounded-full group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-white/80",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-white/10 group-[.toast]:text-white",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
