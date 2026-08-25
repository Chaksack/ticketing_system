function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

export async function sendStaffInviteEmail(params: { to: string, name: string, token: string }) {
  const config = useRuntimeConfig()
  const link = `${trimTrailingSlash(config.siteUrl)}/invite/${params.token}`

  await sendGmailMessage({
    to: params.to,
    subject: 'You\'ve been invited to IBS Ticketing System',
    html: `
      <p>Hi ${params.name},</p>
      <p>You've been added as staff on IBS Ticketing System. Click the link below to create your password and get started:</p>
      <p><a href="${link}">${link}</a></p>
      <p>This link expires in 48 hours. If you weren't expecting this, you can ignore this email.</p>
    `,
  })
}

export async function sendTicketReplyEmail(params: { to: string, name: string, ticketId: string, subject: string, message: string }) {
  await sendGmailMessage({
    to: params.to,
    subject: `Re: [${params.ticketId}] ${params.subject}`,
    ticketId: params.ticketId,
    html: `
      <p>Hi ${params.name},</p>
      <p>Our support team has replied to your ticket <strong>${params.ticketId}</strong>:</p>
      <blockquote style="margin:0;padding:12px 16px;border-left:3px solid #ccc;color:#333;">${params.message.replaceAll('\n', '<br>')}</blockquote>
      <p>Reply to this email if you have further questions.</p>
    `,
  })
}

export async function sendPasswordResetEmail(params: { to: string, name: string, token: string }) {
  const config = useRuntimeConfig()
  const link = `${trimTrailingSlash(config.siteUrl)}/reset-password/${params.token}`

  await sendGmailMessage({
    to: params.to,
    subject: 'Reset your IBS Ticketing System password',
    html: `
      <p>Hi ${params.name},</p>
      <p>We received a request to reset your password. Click the link below to choose a new one:</p>
      <p><a href="${link}">${link}</a></p>
      <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    `,
  })
}
