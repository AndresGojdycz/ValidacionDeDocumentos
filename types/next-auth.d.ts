import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    accessToken?: string;
    error?: string; // To propagate token refresh errors
    user?: {
      id?: string | null; // If you need user ID from provider
    } & DefaultSession['user'];
  }

  // If you need to add properties to the User object itself
  // interface User {
  //   id?: string;
  // }
}

declare module 'next-auth/jwt' {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number; 
    id?: string; // If you need user ID from provider
    error?: "RefreshAccessTokenError"; // For specific error states
  }
} 