import { Component, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { OpsLayout } from "./OpsLayout";

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Catches render-time crashes in the ops dispatch tree so /ops never
 *  paints a blank page. Shows a reload affordance instead. */
export class OpsErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("OpsDispatch crashed:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <OpsLayout>
        <div className="mx-auto mt-6 max-w-md rounded-2xl border border-error/30 bg-error-tint p-6 text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-error" strokeWidth={2} />
          <p className="mt-2 text-[16px] font-semibold text-ink">Something went wrong</p>
          <p className="mt-1 text-[13px] text-ink-secondary">
            Dispatch hit an unexpected error. Reload to try again.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex h-10 items-center rounded-full bg-ink px-4 text-[13px] font-semibold text-white"
          >
            Reload
          </button>
        </div>
      </OpsLayout>
    );
  }
}