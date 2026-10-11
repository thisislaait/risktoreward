// Supabase settings. Without them FundedDesk runs in local mode: no sign-in, data stays in the browser.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const authEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY);

/** Pages a signed-out visitor may open. */
export const PUBLIC_PATHS = ['/login', '/auth'];

export function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
}
