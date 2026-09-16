// Mailer stub. Swap for a real provider (Resend / SES / SendGrid) behind this interface.
// Kept trivially simple — enquiry + invoice emails are low-volume (architecture.md §9).

export async function sendMail({ to, subject, body }) {
  // --- real provider call goes here ---
  console.log(`[mailer] → ${to} | ${subject}`);
  return { ok: true };
}
