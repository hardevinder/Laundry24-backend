import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  // Stripe now expects a specific API version enum or literal type.
  // To prevent type errors, safely cast the value:
  apiVersion: "2024-06-20" as any,
});
