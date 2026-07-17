import { Redirect } from "expo-router";

// The legacy rental-payment demo must never change a request to paid from the
// client. Sponsored-post QPay testing continues in /sponsor-payment.
export default function PaymentScreen() {
  return <Redirect href="/rental-requests" />;
}