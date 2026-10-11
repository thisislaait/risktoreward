import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_KEY, SUPABASE_URL, authEnabled, isPublicPath } from '@/lib/supabase/config';

/**
 * Refreshes the Supabase session on every page request and keeps signed-out visitors out.
 * A user with two-factor set up who hasn't entered their code this session is sent to /login/verify.
 */
export async function proxy(request: NextRequest) {
  if (!authEnabled) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Validates the session token and refreshes it if needed. Must run before anything reads the session.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const { pathname, search } = request.nextUrl;

  const redirect = (to: string) => {
    const url = request.nextUrl.clone();
    const [path, query] = to.split('?');
    url.pathname = path;
    url.search = query ? `?${query}` : '';
    const res = NextResponse.redirect(url);
    // Carry any refreshed session cookies onto the redirect.
    response.cookies.getAll().forEach(c => res.cookies.set(c));
    return res;
  };

  if (!signedIn) {
    if (isPublicPath(pathname)) return response;
    return redirect(`/login?next=${encodeURIComponent(pathname + search)}`);
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const needsCode = aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2';
  if (needsCode && pathname !== '/login/verify' && !pathname.startsWith('/auth')) {
    return redirect(`/login/verify?next=${encodeURIComponent(pathname + search)}`);
  }
  if (!needsCode && (pathname === '/login' || pathname === '/login/verify')) {
    return redirect('/trade');
  }
  return response;
}

export const config = {
  // Every page except Next's own assets and static files.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
