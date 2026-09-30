import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  configure: vi.fn(),
  isConfigured: vi.fn(),
  getAppUserID: vi.fn(),
  logIn: vi.fn(),
  getProducts: vi.fn(),
  purchaseStoreProduct: vi.fn(),
  getOfferings: vi.fn(),
  restorePurchases: vi.fn(),
}));

vi.mock("@revenuecat/purchases-capacitor", () => ({
  Purchases: sdk,
  PRODUCT_CATEGORY: { NON_SUBSCRIPTION: "NON_SUBSCRIPTION" },
}));

import { capacitorRevenueCatBridge } from "./revenuecat";

describe("Capacitor RevenueCat adapter", () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it("configures purchases with the signed-in app user ID", async () => {
    sdk.isConfigured.mockResolvedValue({ isConfigured: false });
    await capacitorRevenueCatBridge.configure({ apiKey: "public-key", appUserID: "user-a" });
    expect(sdk.configure).toHaveBeenCalledWith({ apiKey: "public-key", appUserID: "user-a" });
    expect(sdk.logIn).not.toHaveBeenCalled();
  });

  it("switches accounts using logIn instead of reconfiguring the SDK", async () => {
    sdk.isConfigured.mockResolvedValue({ isConfigured: true });
    sdk.getAppUserID.mockResolvedValue({ appUserID: "user-a" });
    await capacitorRevenueCatBridge.configure({ apiKey: "public-key", appUserID: "user-b" });
    expect(sdk.logIn).toHaveBeenCalledWith({ appUserID: "user-b" });
    expect(sdk.configure).not.toHaveBeenCalled();
  });

  it("purchases the exact non-subscription product and preserves the transaction ID", async () => {
    const product = { identifier: "com.eazilychina.app.trippass" };
    sdk.getProducts.mockResolvedValue({ products: [{ identifier: "other" }, product] });
    sdk.purchaseStoreProduct.mockResolvedValue({ transaction: { transactionIdentifier: "transaction-1" } });
    const result = await capacitorRevenueCatBridge.purchase({ identifier: product.identifier });
    expect(sdk.getProducts).toHaveBeenCalledWith({ productIdentifiers: [product.identifier], type: "NON_SUBSCRIPTION" });
    expect(sdk.purchaseStoreProduct).toHaveBeenCalledWith({ product });
    expect(result).toMatchObject({ success: true, transaction: { transactionIdentifier: "transaction-1" } });
  });

  it("does not buy a different product when the Trip Pass is unavailable", async () => {
    sdk.getProducts.mockResolvedValue({ products: [{ identifier: "other" }] });
    await expect(capacitorRevenueCatBridge.purchase({ identifier: "trip-pass" })).rejects.toMatchObject({
      code: "PRODUCT_NOT_AVAILABLE_FOR_PURCHASE",
    });
    expect(sdk.purchaseStoreProduct).not.toHaveBeenCalled();
  });
});
