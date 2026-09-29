export {};

declare global {
  /** Global helper: true when the app is running inside the Median native wrapper */
  var isMedianApp: boolean;

  interface Window {
    isMedianApp: boolean;
  }
}
