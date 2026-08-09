import { auth } from "@/lib/auth";

// Redirects unauthenticated requests to /signin (via the `authorized` callback).
export default auth;

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon\\.ico|signin).*)"],
};
