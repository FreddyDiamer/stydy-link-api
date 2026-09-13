/**
 * Path templates for deep links to the mini-app (no host).
 * Must match study-link/src/router/paths.ts.
 * Use with buildFrontendUrl(baseUrl, path, params) to get full URL.
 */
export const FRONTEND_PATHS = {
  /** There is no public profile screen yet — the feed is the closest entry */
  USER_PROFILE: '/market',
  /** Deals tab (both roles share one list) */
  STUDENT_ORDERS: '/deals',
  /** Deal details: the deals list, there is no per-deal route yet */
  STUDENT_DEAL_DETAILS: '/deals',
  /** Reviews live on the profile screen */
  STUDENT_REVIEWS: '/profile',
  /** Deals tab (both roles share one list) */
  TUTOR_ORDERS: '/deals',
  /** Deal details: the deals list, there is no per-deal route yet */
  TUTOR_DEAL_DETAILS: '/deals',
  /** Bookings on a service are shown on the service screen to its owner */
  TUTOR_SERVICE_RESPONSES: '/market/services/:id',
  /** Reviews live on the profile screen */
  TUTOR_REVIEWS: '/profile',
} as const;

/**
 * Build full frontend URL from base URL and path template.
 * Replaces :id placeholders with values from params (e.g. { id: 'uuid' } or { id: dealId }).
 */
export function buildFrontendUrl(
  baseUrl: string,
  pathTemplate: string,
  params: Record<string, string>,
): string {
  const base = baseUrl.replace(/\/$/, '');
  let path = pathTemplate;
  for (const [key, value] of Object.entries(params)) {
    path = path.replace(`:${key}`, value);
  }
  return `${base}${path.startsWith('/') ? path : '/' + path}`;
}
