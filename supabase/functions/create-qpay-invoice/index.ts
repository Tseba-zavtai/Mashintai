// Retired legacy payment route. Only qpay-service may create/verify orders.
Deno.serve((req: Request) => new Response(JSON.stringify({ error: "USE_QPAY_SERVICE" }), {
  status: req.method === "OPTIONS" ? 200 : 410,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  },
}));
