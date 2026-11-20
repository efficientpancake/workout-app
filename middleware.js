import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Every page needs a signed-in user whose email is on ALLOWED_EMAIL.
// Without the Supabase keys (localhost before setup), the app stays open and
// saves to the browser instead.
export async function middleware(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const allowed = (process.env.ALLOWED_EMAIL || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const email = user?.email?.toLowerCase();
  const isLogin = request.nextUrl.pathname.startsWith("/login");

  const redirect = (path, denied = false) => {
    const to = request.nextUrl.clone();
    to.pathname = path;
    to.search = denied ? "?denied=1" : "";
    const res = NextResponse.redirect(to);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  // Signed in but not on the list: sign them out and send back to login.
  if (user && allowed.length && !allowed.includes(email)) {
    await supabase.auth.signOut();
    return isLogin ? response : redirect("/login", true);
  }

  if (!user && !isLogin) return redirect("/login");
  if (user && isLogin) return redirect("/");
  return response;
}

export const config = {
  // Skip Next's own files and the home-screen icon/manifest so the icon still
  // shows when adding to the home screen.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|apple-icon|manifest.webmanifest).*)"],
};
