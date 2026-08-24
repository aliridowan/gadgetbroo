import { authClient } from "../lib/auth-client";
import { useCart } from "../store/useCart";

export const handleSignOut = async () => {
  const { error } = await authClient.signOut();

  if (error) {
    throw new Error(error.message || "User logout failed")
  }

  // The cart store persists to localStorage keyed by browser, not by
  // account — nothing else ever clears it, so without this, whoever logs
  // into this browser next inherits the previous account's cart. On
  // their first sync (CartSync.tsx, on login) that stale local cart gets
  // pushed into THEIR server-side cart, not just displayed — a real
  // cross-account data write, not a cosmetic staleness bug.
  //
  // setState directly, not clearCart() — clearCart() also POSTs
  // action:"clear" to /api/cart/sync, which would delete the
  // now-logged-out user's actual saved server-side cart. Logging out
  // must never do that; it should only stop showing their cart to
  // whoever logs in next. Same "bypass the normal action" pattern
  // CartSync.tsx already uses when it overwrites local state from a
  // server response.
  useCart.setState({ items: [] });
};
