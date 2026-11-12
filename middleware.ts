import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// First gate only: keeps signed-out visitors away from /admin. Every page and
// server action re-checks the user against the database (lib/authz.ts).
export default NextAuth(authConfig).auth;

export const config = { matcher: ["/admin/:path*"] };
