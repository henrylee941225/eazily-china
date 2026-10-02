import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearUserLocalState } from "./clearUserLocalState";
import { HOME_CACHE_MAX_AGE_MS, readHomeCache, writeHomeCache } from "./homeCache";

const isString = (value: unknown): value is string => typeof value === "string";

describe("Home snapshots", () => {
  beforeEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it("isolates data by user and clears it on sign-out", () => {
    writeHomeCache("user-a", "bookings", "booking-a");
    expect(readHomeCache("user-a", "bookings", isString)).toBe("booking-a");
    expect(readHomeCache("user-b", "bookings", isString)).toBeUndefined();
    expect(readHomeCache("user-a", "plan", isString)).toBeUndefined();

    clearUserLocalState();
    expect(readHomeCache("user-a", "bookings", isString)).toBeUndefined();
  });

  it("ignores expired or invalid snapshots", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T00:00:00Z"));
    writeHomeCache("user-a", "bookings", "booking-a");
    expect(readHomeCache("user-a", "bookings", isString)).toBe("booking-a");

    vi.setSystemTime(Date.now() + HOME_CACHE_MAX_AGE_MS + 1);
    expect(readHomeCache("user-a", "bookings", isString)).toBeUndefined();
    vi.useRealTimers();

    window.localStorage.setItem("home:cache:v1:user-a:plan", "broken JSON");
    expect(readHomeCache("user-a", "plan", isString)).toBeUndefined();
  });
});
