export async function sendMail(options: { to: string, subject: string, html: string }) {
  const config = useRuntimeConfig()

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.resendFromEmail,
      to: options.to,
      subject: options.subject,
      html: options.html,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Resend send failed (${response.status}): ${body}`)
  }
}

export async function sendStaffInviteEmail(params: { to: string, name: string, token: string }) {
  const config = useRuntimeConfig()
  const link = `${config.siteUrl.replace(/\/+$/, '')}/invite/${params.token}`

  await sendMail({
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
  await sendMail({
    to: params.to,
    subject: `Re: [${params.ticketId}] ${params.subject}`,
    html: `
      <p>Hi ${params.name},</p>
      <p>Our support team has replied to your ticket <strong>${params.ticketId}</strong>:</p>
      <blockquote style="margin:0;padding:12px 16px;border-left:3px solid #ccc;color:#333;">${params.message.replace(/\n/g, '<br>')}</blockquote>
      <p>Reply to this email or contact us if you have further questions.</p>
    `,
  })
}

export async function sendPasswordResetEmail(params: { to: string, name: string, token: string }) {
  const config = useRuntimeConfig()
  const link = `${config.siteUrl.replace(/\/+$/, '')}/reset-password/${params.token}`

  await sendMail({
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
