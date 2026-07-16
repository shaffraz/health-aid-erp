type EmailDraftInput = {
  to?: string;
  subject: string;
  body: string;
};

export function openEmailDraft({ to = "", subject, body }: EmailDraftInput) {
  const params = new URLSearchParams({
    subject,
    body
  });
  const recipient = to.trim().replace(/\s+/g, "");

  window.location.href = `mailto:${encodeURI(recipient)}?${params.toString()}`;
}
