import NextAuth, { NextAuthOptions, Account, Profile } from "next-auth";
import { JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline", // Request refresh token
          response_type: "code",
          scope: "openid email profile https://www.googleapis.com/auth/drive.readonly", // Added drive.readonly scope
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET as string,
  callbacks: {
    async jwt({ token, account, profile }: { token: JWT; account: Account | null; profile?: Profile }) {
      // Persist the OAuth access_token and refresh_token to the token right after signin
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token; // Store the refresh token
        token.accessTokenExpires = account.expires_at ? Date.now() + account.expires_at * 1000 : undefined; // Store expiry time
        // token.id = profile?.sub; // Google typically uses `sub` for user ID in profile
      }
      
      // Return previous token if the access token has not expired yet
      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {
        return token;
      }

      // Access token has expired, try to update it using the refresh token.
      if (token.refreshToken) {
        try {
          const response = await fetch("https://oauth2.googleapis.com/token", {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID as string,
              client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
              grant_type: "refresh_token",
              refresh_token: token.refreshToken as string, // Assert refreshToken as string
            }),
            method: "POST",
          });

          const refreshedTokens = await response.json();

          if (!response.ok) {
            throw refreshedTokens;
          }

          return {
            ...token,
            accessToken: refreshedTokens.access_token,
            accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
            refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // Fall back to old refresh token
          };
        } catch (error) {
          console.error("Error refreshing access token", error);
          // Sign the user out if the refresh token is invalid / revoked
          // token.error = "RefreshAccessTokenError"; // You can set an error code here
          // Consider how you want to handle this - perhaps by returning the old token and letting API calls fail
          // or by explicitly revoking the session / redirecting to sign-in.
          // For now, return token, which will likely cause Drive API calls to fail, prompting re-login.
          return { ...token, error: "RefreshAccessTokenError" as const };
        }
      }
      
      return token;
    },
    async session({ session, token }: { session: any; token: JWT }) {
      // Send properties to the client, like an access_token and user id from a provider.
      session.accessToken = token.accessToken;
      session.error = token.error;
      // if (token.id) session.user.id = token.id;
      return session;
    },
  },
  // Optional: Add pages for custom sign-in, sign-out, error pages
  // pages: {
  //   signIn: '/auth/signin',
  //   signOut: '/auth/signout',
  //   error: '/auth/error', // Error code passed in query string as ?error=
  //   verifyRequest: '/auth/verify-request', // (used for email/passwordless sign in)
  //   newUser: '/auth/new-user' // New users will be directed here on first sign in (leave the property out to disable)
  // }
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST }; 