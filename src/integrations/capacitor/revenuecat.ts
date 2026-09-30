import { Purchases, PRODUCT_CATEGORY } from "@revenuecat/purchases-capacitor";

// Serialize configuration so auth changes cannot configure the SDK concurrently.
let configuration: Promise<unknown> = Promise.resolve();

export const capacitorRevenueCatBridge = {
  configure: (params: { apiKey: string; appUserID: string }): Promise<unknown> => {
    const task = configuration.catch(() => {}).then(async () => {
      const { isConfigured } = await Purchases.isConfigured();
      if (!isConfigured) return Purchases.configure(params);
      const { appUserID } = await Purchases.getAppUserID();
      if (appUserID !== params.appUserID) return Purchases.logIn({ appUserID: params.appUserID });
    });
    configuration = task;
    return task;
  },
  isInitialized: async (): Promise<boolean> => (await Purchases.isConfigured()).isConfigured,
  purchase: async ({ identifier }: { identifier: string }) => {
    const { products } = await Purchases.getProducts({
      productIdentifiers: [identifier],
      type: PRODUCT_CATEGORY.NON_SUBSCRIPTION,
    });
    const product = products.find((item) => item.identifier === identifier);
    if (!product) {
      throw Object.assign(new Error("Trip Pass is unavailable in the store"), { code: "PRODUCT_NOT_AVAILABLE_FOR_PURCHASE" });
    }
    const result = await Purchases.purchaseStoreProduct({ product });
    return { ...result, success: true };
  },
  getOfferings: () => Purchases.getOfferings(),
  restorePurchases: () => Purchases.restorePurchases(),
};
