import { cache } from "react";
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
    async jwt({ token, user, trigger }) {
      // Every signed-in employee gets a User row; ownerId, authorId and
      // Assignment all point at it. Imported lazily so the proxy bundle,
      // which loads this module for `authorized`, never pulls in Prisma.
      if ((trigger === "signIn" || trigger === "signUp") && user?.email) {
        const { upsertUserByEmail } = await import("@/lib/users");
        try {
          const dbUser = await upsertUserByEmail(user.email, user.name);
          token.uid = dbUser.id;
        } catch (error) {
          // Surface the real cause plainly — Auth.js wraps whatever throws
          // here into an opaque CallbackRouteError.
          console.error(
            "[auth] Sign-in failed: could not create or load the user row. " +
              "Usually the app cannot reach the database — run `npm run db:check`.",
            error,
          );
          throw error;
        }
      }
      return token;
    },
    session({ session, token }) {
      // Only a database id is ever exposed as session.user.id — tokens
      // minted before the user row existed carry an empty id, and
      // getCurrentUser resolves those against the database.
      session.user.id = typeof token.uid === "string" ? token.uid : "";
      return session;
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

export const getCurrentUser = cache(
  async (): Promise<CurrentUser | null> => {
    const session = await auth();
    const user = session?.user;
    if (!user?.email) return null;
    if (user.id) {
      return { id: user.id, name: user.name ?? user.email, email: user.email };
    }
    // Session predates the user-row upsert — resolve (and create) it now.
    const { upsertUserByEmail } = await import("@/lib/users");
    const dbUser = await upsertUserByEmail(user.email, user.name);
    return { id: dbUser.id, name: dbUser.name, email: dbUser.email };
  },
);
