/**
 * Path templates for deep links to the mini-app (no host).
 * Must match study-link/src/router/paths.ts.
 * Use with buildFrontendUrl(baseUrl, path, params) to get full URL.
 */
export const FRONTEND_PATHS = {
  /** Public user profile: /user/:id */
  USER_PROFILE: '/user/:id',
  /** Student: orders list */
  STUDENT_ORDERS: '/student/orders',
  /** Student: deal details */
  STUDENT_DEAL_DETAILS: '/student/deals/:id',
  /** Student: reviews */
  STUDENT_REVIEWS: '/student/reviews',
  /** Tutor: orders list */
  TUTOR_ORDERS: '/tutor/orders',
  /** Tutor: deal details */
  TUTOR_DEAL_DETAILS: '/tutor/deals/:id',
  /** Tutor: service responses for a service */
  TUTOR_SERVICE_RESPONSES: '/tutor/services/:id/responses',
  /** Tutor: reviews */
  TUTOR_REVIEWS: '/tutor/reviews',
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
