import { NATIVE_URL_SCHEME } from "./index";

export const parseNativeDeepLink = (rawUrl: string) => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== `${NATIVE_URL_SCHEME}:` || url.hostname !== "app") return null;
  // URL parsers preserve encoded slashes, which must not become external redirects.
  if (!url.pathname.startsWith("/") || url.pathname.startsWith("//") || url.pathname.includes("\\") || /%2f|%5c/i.test(url.pathname)) return null;

  const hash = new URLSearchParams(url.hash.slice(1));
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  const code = url.searchParams.get("code");
  const error = hash.get("error_description") ?? url.searchParams.get("error_description");
  url.searchParams.delete("code");
  url.searchParams.delete("error");
  url.searchParams.delete("error_description");

  return {
    path: `${url.pathname}${url.search}`,
    code,
    session: accessToken && refreshToken
      ? { access_token: accessToken, refresh_token: refreshToken }
      : null,
    error,
  };
};
