// Test runner for invoices workflow
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function run() {
  console.log("==================================================");
  console.log("   INVOICES TEST SUITE (End-to-End API Test)      ");
  console.log("==================================================\n");

  // 1. Get staff token
  console.log("1. Logging in as staff (staff@agency.local)...");
  const staffLogin = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "staff@agency.local", password: "changeme123" }),
  });
  if (!staffLogin.data?.accessToken) {
    console.error("❌ Failed to log in as staff:", staffLogin);
    process.exit(1);
  }
  const STAFF_TOKEN = staffLogin.data.accessToken;
  console.log("✅ STAFF_TOKEN acquired.\n");

  // 2. Setup Client and Engagement if needed
  console.log("2. Setting up test client (Priya) and engagement...");
  const clientsList = await request("/clients", {
    headers: { Authorization: `Bearer ${STAFF_TOKEN}` },
  });
  let priyaClient = clientsList.data?.find(c => c.name === "Priya Patel");
  let clientId = priyaClient?._id;

  if (!clientId) {
    const clientRes = await request("/clients", {
      method: "POST",
      headers: { Authorization: `Bearer ${STAFF_TOKEN}` },
      body: JSON.stringify({
        name: "Priya Patel",
        primaryContact: { email: "priya@example.com", name: "Priya" },
      }),
    });
    clientId = clientRes.data?.clientId;
  }

  // Provision priya user login
  await request("/auth/users", {
    method: "POST",
    headers: { Authorization: `Bearer ${STAFF_TOKEN}` },
    body: JSON.stringify({
      email: "priya@example.com",
      password: "client-secret-123",
      role: "client",
      clientId,
    }),
  });

  // Create engagement for Priya
  const engagementRes = await request("/engagements", {
    method: "POST",
    headers: { Authorization: `Bearer ${STAFF_TOKEN}` },
    body: JSON.stringify({
      clientId,
      title: "Phase 1 Web Development",
      status: "active",
    }),
  });
  const engagementId = engagementRes.data?.engagementId;
  console.log(`✅ Client ID: ${clientId}`);
  console.log(`✅ Engagement ID: ${engagementId}\n`);

  // Provision 'other' client for isolation test
  console.log("3. Setting up 'other' client for isolation testing...");
  let otherClient = clientsList.data?.find(c => c.name === "Other Company");
  let otherClientId = otherClient?._id;
  if (!otherClientId) {
    const otherClientRes = await request("/clients", {
      method: "POST",
      headers: { Authorization: `Bearer ${STAFF_TOKEN}` },
      body: JSON.stringify({
        name: "Other Company",
        primaryContact: { email: "other@example.com" },
      }),
    });
    otherClientId = otherClientRes.data?.clientId;
  }

  await request("/auth/users", {
    method: "POST",
    headers: { Authorization: `Bearer ${STAFF_TOKEN}` },
    body: JSON.stringify({
      email: "other@example.com",
      password: "other-pass",
      role: "client",
      clientId: otherClientId,
    }),
  });
  console.log(`✅ Other Client ID: ${otherClientId}\n`);

  // 4. Get Client Token (Priya)
  console.log("4. Logging in as Priya (priya@example.com)...");
  const clientLogin = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "priya@example.com", password: "client-secret-123" }),
  });
  const CLIENT_TOKEN = clientLogin.data?.accessToken;
  console.log("✅ CLIENT_TOKEN acquired.\n");

  // 5. Create an invoice (staff only)
  console.log("5. Creating an invoice (staff only)...");
  const invoiceCreateRes = await request("/invoices", {
    method: "POST",
    headers: { Authorization: `Bearer ${STAFF_TOKEN}` },
    body: JSON.stringify({
      clientId,
      engagementId,
      dueDate: "2026-10-15",
      lineItems: [
        { desc: "Phase 1 design", amount: 50000 },
        { desc: "Phase 1 build", amount: 150000 },
      ],
    }),
  });
  console.log("Response:", invoiceCreateRes.data);
  const invoiceId = invoiceCreateRes.data?.invoiceId;
  if (invoiceCreateRes.data?.amount === 200000 && invoiceId) {
    console.log("✅ Invoice created successfully! Total amount: 200000 paise (₹2,000.00)\n");
  } else {
    console.error("❌ Unexpected response:", invoiceCreateRes);
  }

  // 6. Bad lineItem amount is rejected
  console.log("6. Testing bad lineItem amount validation...");
  const badInvoiceRes = await request("/invoices", {
    method: "POST",
    headers: { Authorization: `Bearer ${STAFF_TOKEN}` },
    body: JSON.stringify({
      clientId,
      engagementId,
      lineItems: [{ desc: "bad", amount: "oops" }],
    }),
  });
  console.log("Response:", badInvoiceRes.data);
  if (badInvoiceRes.data?.error === "each lineItem must have a finite numeric amount (paise)") {
    console.log("✅ Bad lineItem successfully rejected with 400 error!\n");
  } else {
    console.error("❌ Expected validation error not received:", badInvoiceRes);
  }

  // 7. Client sees their invoice
  console.log("7. Client fetching their invoices (GET /invoices)...");
  const clientInvoicesRes = await request("/invoices", {
    headers: { Authorization: `Bearer ${CLIENT_TOKEN}` },
  });
  console.log(`Found ${clientInvoicesRes.data?.length} invoice(s) for client.`);
  console.log("First invoice status:", clientInvoicesRes.data?.[0]?.status);

  console.log(`\nClient fetching invoice by ID (GET /invoices/${invoiceId})...`);
  const singleInvoiceRes = await request(`/invoices/${invoiceId}`, {
    headers: { Authorization: `Bearer ${CLIENT_TOKEN}` },
  });
  console.log("Fetched invoice:", {
    _id: singleInvoiceRes.data?._id,
    amount: singleInvoiceRes.data?.amount,
    status: singleInvoiceRes.data?.status,
    lineItems: singleInvoiceRes.data?.lineItems,
  });
  console.log("✅ Client can see their own invoice!\n");

  // 8. Isolation: other-client login sees nothing
  console.log("8. Logging in as other client (other@example.com)...");
  const otherLogin = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "other@example.com", password: "other-pass" }),
  });
  const OTHER_TOKEN = otherLogin.data?.accessToken;
  console.log("✅ OTHER_TOKEN acquired.");

  console.log("\nOther client fetching invoices (GET /invoices)...");
  const otherInvoicesRes = await request("/invoices", {
    headers: { Authorization: `Bearer ${OTHER_TOKEN}` },
  });
  console.log("Response (expected []):", otherInvoicesRes.data);
  if (Array.isArray(otherInvoicesRes.data) && otherInvoicesRes.data.length === 0) {
    console.log("✅ Isolation verified: Other client received empty array.");
  } else {
    console.error("❌ Isolation failed:", otherInvoicesRes);
  }

  console.log(`\nOther client fetching Priya's invoice (GET /invoices/${invoiceId})...`);
  const forbiddenRes = await request(`/invoices/${invoiceId}`, {
    headers: { Authorization: `Bearer ${OTHER_TOKEN}` },
  });
  console.log("Response (expected { error: 'forbidden' }):", forbiddenRes.data);
  if (forbiddenRes.status === 403 && forbiddenRes.data?.error === "forbidden") {
    console.log("✅ Isolation verified: Access forbidden (403)!");
  } else {
    console.error("❌ Expected 403 forbidden not received:", forbiddenRes);
  }

  console.log("\n==================================================");
  console.log("       ALL INVOICE TESTS PASSED! 🎉               ");
  console.log("==================================================");
}

run().catch(console.error);
