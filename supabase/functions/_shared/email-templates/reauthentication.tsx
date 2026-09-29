/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>eazilyChina</Text>
        <Heading style={h1}>Confirm it's you</Heading>
        <Text style={text}>Enter this code to confirm your identity.</Text>
        <Section style={codeCard}>
          <Text style={codeStyle}>{token}</Text>
        </Section>
        <Text style={footer}>
          This code will expire shortly. If you didn't request this, you can
          safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const font = "'Hanken Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
const main = { backgroundColor: '#ffffff', fontFamily: font, margin: 0, padding: 0 }
const container = { padding: '32px 24px', maxWidth: '520px' }
const brand = { fontSize: '13px', fontWeight: 600 as const, letterSpacing: '0.02em', color: '#DE2910', margin: '0 0 28px' }
const h1 = { fontSize: '26px', fontWeight: 800 as const, color: '#0A0A0B', lineHeight: 1.15, margin: '0 0 12px' }
const text = { fontSize: '15px', color: '#6E6E73', lineHeight: 1.5, margin: '0 0 24px' }
const codeCard = { backgroundColor: '#F6F6F7', borderRadius: '16px', padding: '24px', textAlign: 'center' as const, margin: '0 0 24px' }
const codeStyle = { fontSize: '36px', fontWeight: 800 as const, letterSpacing: '0.24em', color: '#0A0A0B', margin: 0 }
const footer = { fontSize: '12px', color: '#B0B0B1', lineHeight: 1.5, margin: '40px 0 0' }
