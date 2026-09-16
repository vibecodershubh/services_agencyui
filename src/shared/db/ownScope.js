// Ownership scoping (architecture.md §7). Single-org, so this is NOT multi-tenancy —
// it's "a client can only see their own records." Staff see everything.
// Enforced centrally so no endpoint can accidentally leak across clients.

export function ownScope(reqContext, filter = {}) {
  const { role, clientId } = reqContext;
  if (role === "staff") return filter;              // staff: unrestricted
  if (!clientId) throw new Error("ownScope: client request without clientId");
  return { ...filter, clientId };
}

export function requireOwnership(reqContext, record) {
  if (reqContext.role === "staff") return true;
  return record && String(record.clientId) === String(reqContext.clientId);
}
