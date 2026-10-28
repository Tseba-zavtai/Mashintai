export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }) {
  // The browser callback is consumed by openAuthSessionAsync. Keep the router
  // on authentication while it verifies the handoff, never flash the feed.
  if (/^(?:tureesly:\/\/)?\/?dan-callback(?:[/?#]|$)/i.test(path)) return '/auth';
  return '/';
}
