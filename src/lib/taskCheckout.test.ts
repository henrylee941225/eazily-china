import { describe, expect, it } from "vitest";
import { getTaskCheckoutReturnUrl } from "@/lib/taskCheckout";

describe("getTaskCheckoutReturnUrl", () => {
  it("uses the public HTTPS origin for the iOS app", () => {
    expect(getTaskCheckoutReturnUrl("task-1", "capacitor://localhost", true)).toBe(
      "https://app.eazilychina.com/bookings/task-1",
    );
  });

  it("uses the public HTTPS origin for the Android app", () => {
    expect(getTaskCheckoutReturnUrl("task-1", "https://localhost", true)).toBe(
      "https://app.eazilychina.com/bookings/task-1",
    );
  });

  it("keeps the current origin for a web preview", () => {
    expect(getTaskCheckoutReturnUrl("task-1", "http://localhost:8080", false)).toBe(
      "http://localhost:8080/bookings/task-1",
    );
  });
});
