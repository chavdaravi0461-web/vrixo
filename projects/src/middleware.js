import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ token }) {
      return !!token;
    },
  },
});

export const config = {
  matcher: ["/profile", "/profile/:path*", "/account", "/account/:path*", "/dashboard", "/dashboard/:path*", "/wishlist", "/wishlist/:path*", "/my-orders", "/my-orders/:path*"],
};
