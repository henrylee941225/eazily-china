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

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to join {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>eazilyChina</Text>
        <Heading style={h1}>You've been invited</Heading>
        <Text style={text}>
          You've been invited to join{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          . Tap the button below to accept and create your account.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Accept invitation
        </Button>
        <Text style={footer}>
          If you weren't expecting this invitation, you can safely ignore this
          email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

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
