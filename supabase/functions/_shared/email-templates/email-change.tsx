/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface EmailChangeEmailProps {
  siteName: string
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail to read
  // "from OLD to NEW" instead of "from NEW to NEW".
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email change for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>eazilyChina</Text>
        <Heading style={h1}>Confirm your email change</Heading>
        <Text style={text}>
          You requested to change your email address for {siteName} from{' '}
          <Link href={`mailto:${oldEmail}`} style={link}>
            {oldEmail}
          </Link>{' '}
          to{' '}
          <Link href={`mailto:${newEmail}`} style={link}>
            {newEmail}
          </Link>
          .
        </Text>
        <Text style={text}>
          Tap the button below to confirm this change:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirm email change
        </Button>
        <Text style={footer}>
          If you didn't request this change, please secure your account
          immediately.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

const font = "'Hanken Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
const main = { backgroundColor: '#ffffff', fontFamily: font, margin: 0, padding: 0 }
const container = { padding: '32px 24px', maxWidth: '520px' }
const brand = { fontSize: '13px', fontWeight: 600 as const, letterSpacing: '0.02em', color: '#DE2910', margin: '0 0 28px' }
const h1 = { fontSize: '26px', fontWeight: 800 as const, color: '#0A0A0B', lineHeight: 1.15, margin: '0 0 12px' }
const text = { fontSize: '15px', color: '#6E6E73', lineHeight: 1.5, margin: '0 0 24px' }
const link = { color: '#DE2910', textDecoration: 'none' }
const button = {
  backgroundColor: '#0A0A0B',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600 as const,
  borderRadius: '999px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = { fontSize: '12px', color: '#B0B0B1', lineHeight: 1.5, margin: '40px 0 0' }
