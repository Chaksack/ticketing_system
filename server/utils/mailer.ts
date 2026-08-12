import nodemailer from 'nodemailer'

let transporter: nodemailer.Transporter | null = null

function getTransporter() {
  if (!transporter) {
    const config = useRuntimeConfig()
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.gmailUser,
        pass: config.gmailAppPassword,
      },
    })
  }

  return transporter
}

export async function sendMail(options: { to: string, subject: string, html: string }) {
  const config = useRuntimeConfig()
  const transport = getTransporter()

  await transport.sendMail({
    from: `"IBS Ticketing System" <${config.gmailUser}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
  })
}

export async function sendStaffInviteEmail(params: { to: string, name: string, token: string }) {
  const config = useRuntimeConfig()
  const link = `${config.siteUrl}/invite/${params.token}`

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
