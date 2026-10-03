const NATIVE_CHECKOUT_RETURN_ORIGIN = "https://app.eazilychina.com";

export const getTaskCheckoutReturnUrl = (
  taskId: string,
  webOrigin: string,
  isNative: boolean,
): string =>
  `${isNative ? NATIVE_CHECKOUT_RETURN_ORIGIN : webOrigin}/bookings/${encodeURIComponent(taskId)}`;
