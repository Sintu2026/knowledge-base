import NextAuth, { type NextAuthConfig } from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";

const issuer = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER;

const entraConfigured = Boolean(
  process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
    issuer,
);

// Tenant id from the issuer URL, e.g. https://login.microsoftonline.com/<tenant>/v2.0
const tenantId = issuer?.match(/login\.microsoftonline\.com\/([^/]+)\//)?.[1];

const providers: NextAuthConfig["providers"] = [];

if (entraConfigured) {
  providers.push(MicrosoftEntraID);
}

// Local development fallback until the Entra app registration exists.
// Never registered outside development.
export const devSignInEnabled =
  !entraConfigured && process.env.NODE_ENV === "development";

if (devSignInEnabled) {
  providers.push(
    Credentials({
      id: "dev",
      name: "Dev sign-in",
      credentials: {},
      async authorize() {
        return {
          id: "dev-user",
          name: "Dev User",
          email: "dev@caizenhomes.com",
        };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  pages: { signIn: "/signin" },
  session: { strategy: "jwt" },
  callbacks: {
    signIn({ account, profile }) {
      if (account?.provider === "dev") return true;
      // The issuer restricts token validation to our tenant already;
      // this is a second check on the tid claim itself.
      if (tenantId && profile && "tid" in profile) {
        return profile.tid === tenantId;
      }
      return true;
    },
    authorized({ auth }) {
      return Boolean(auth?.user);
    },
  },
});

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.email) return null;
  return {
    id: user.id ?? user.email,
    name: user.name ?? user.email,
    email: user.email,
  };
}
