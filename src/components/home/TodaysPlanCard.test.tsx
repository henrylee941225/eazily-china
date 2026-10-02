import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { writeHomeCache } from "@/lib/homeCache";

const db = vi.hoisted(() => ({
  fetchPlan: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "user-a" } }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({ limit: db.fetchPlan }),
        }),
      }),
    }),
  },
}));

import { TodaysPlanCard } from "./TodaysPlanCard";

const planRow = (title: string) => ({
  id: "plan-1",
  title,
  updated_at: "2026-10-02T00:00:00Z",
  plan: { stops: [{ done: false, placeName: "The Bund", startTime: "09:00" }] },
});

describe("Today's plan on Home", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.clear();
  });

  it("shows the saved card immediately and refreshes it in the background", async () => {
    writeHomeCache("user-a", "plan", planRow("Saved plan"));
    let finishFetch!: (value: { data: ReturnType<typeof planRow>[]; error: null }) => void;
    db.fetchPlan.mockReturnValue(new Promise((resolve) => { finishFetch = resolve; }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><TodaysPlanCard /></MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText("Saved plan")).toBeInTheDocument();
    finishFetch({ data: [planRow("Updated plan")], error: null });
    await waitFor(() => expect(screen.getByText("Updated plan")).toBeInTheDocument());
  });
});
