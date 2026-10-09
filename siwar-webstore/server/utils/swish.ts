// server/utils/swish.ts
import https from 'node:https'
import fs from 'node:fs'
import { URL } from 'node:url'
import { randomUUID } from 'node:crypto'

/**
 * Input parameters required to initiate a Swish payment request.
 */
export interface SwishPaymentInput {
  /** Payment amount in Swedish ören (minor currency unit: 1 SEK = 100 ören) */
  amountMinorSEK: number
  /** Unique merchant order reference sent to Swish and returned in callbacks */
  payeePaymentReference: string
  /** Optional customer-facing message displayed inside the Swish mobile app (max 50 chars) */
  message?: string

  /** Optional 32-char uppercase hex UUID to enforce idempotency on Swish */
  instructionUUID?: string
}


export interface SwishRefundInput {
  /** Original payment ID / instructionUUID returned when payment was created */
  originalPaymentReference: string
  /** Amount to refund in ören */
  amountMinorSEK: number
  /** Merchant order reference */
  payerPaymentReference: string
  /** Message visible on the customer's Swish transaction log (max 50 chars) */
  message?: string
}

/**
 * Standardized response object returned after registering a Swish payment request.
 */
export interface SwishResponse {
  /** 32-character uppercase hex UUID identifying the payment instruction */
  instructionUUID: string
  /** Payment token used to trigger the Swish app on mobile or generate QR codes */
  token: string
  /** Self-contained Base64 SVG Data URL for instant QR code rendering */
  qrSvgUrl: string
}

/**
 * Fetches an official Swish QR code SVG from the Swish QR generator API
 * and converts it into a self-contained Base64 Data URL.
 *
 * This allows the frontend to render the QR code immediately inside a standard
 * `<img>` element without requiring extra external API roundtrips or raw SVG sanitization.
 *
 * @param token - Payment request token returned from the Swish commerce endpoint.
 * @returns Base64 SVG data URI string, or an empty string if generation fails.
 */
async function fetchSwishQrDataUrl(token: string): Promise<string> {
  try {
    const res = await fetch('https://mpc.getswish.net/qrg-swish/api/v1/commerce', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        format: 'svg',
        size: 300,
        border: 0,
      }),
    })

    if (!res.ok) {
      console.error(`Swish QR generation failed: ${res.status} ${res.statusText}`)
      return ''
    }

    const svgText = await res.text()
    const base64 = Buffer.from(svgText).toString('base64')
    return `data:image/svg+xml;base64,${base64}`
  } catch (err) {
    console.error('Error fetching Swish QR code:', err)
    return ''
  }
}

/**
 * Initiates an e-commerce payment request with the Swish API over mutual TLS (mTLS).
 *
 * Implements the Swish Merchant API v2 specification:
 * - Generates a 32-character uppercase hexadecimal UUID without hyphens as required by Swish.
 * - Formats amounts to two decimal places in major currency units (SEK).
 * - Enforces the 50-character limit on the customer-visible message.
 * - Authenticates using client-side PEM certificates and keys over an HTTPS PUT request.
 * - Retrieves the `PaymentRequestToken` header from the response.
 * - Generates an embedded SVG QR code Data URL for desktop shoppers.
 *
 * @param input - Payment details including amount in ören, order reference, and description message.
 * @throws Error if client certificates are missing, the mTLS handshake fails, or Swish rejects the request.
 * @returns Promise resolving to the instruction UUID, mobile token, and QR code SVG Data URL.
 */
export function createSwishPaymentRequest(input: SwishPaymentInput): Promise<SwishResponse> {
  return new Promise((resolve, reject) => {
    const config = useRuntimeConfig()
    const isTest = config.swishEnv === 'test'

    // // Swish specification strictly requires instruction UUIDs to be 32 uppercase hexadecimal characters without hyphens
    // const instructionUUID = randomUUID().replace(/-/g, '').toUpperCase()

    // Swish requires 32 uppercase hexadecimal characters without hyphens
    const rawUuid = input.instructionUUID?.replace(/-/g, '')
    const instructionUUID =
      rawUuid && /^[0-9A-F]{32}$/i.test(rawUuid)
        ? rawUuid.toUpperCase()
        : randomUUID().replace(/-/g, '').toUpperCase()

    // Swish expects major units (SEK) formatted with exactly two decimal places (e.g., "199.00")
    const amountStr = (input.amountMinorSEK / 100).toFixed(2)

    // Swish e-commerce payload constraints
    const payload = JSON.stringify({
      payeePaymentReference: input.payeePaymentReference,
      callbackUrl: config.swishCallbackUrl,
      payeeAlias: config.swishPayeeAlias,
      currency: 'SEK',
      amount: amountStr,
      // Message displayed to customer in the Swish mobile app, constrained to 50 characters maximum
      message: (input.message || 'Siwar Webstore').substring(0, 50),
    })

    // Select the appropriate host based on test or production environment
    const targetUrl = new URL(
      isTest
        ? `https://mss.cpc.getswish.net/swish-cpcapi/api/v2/paymentrequests/${instructionUUID}`
        : `https://cpc.getswish.net/swish-cpcapi/api/v2/paymentrequests/${instructionUUID}`
    )

    // Verify that the required client certificate files exist on the filesystem before attempting connection
    if (!fs.existsSync(config.swishCertPath) || !fs.existsSync(config.swishKeyPath)) {
      return reject(
        new Error(`Swish certificates missing at ${config.swishCertPath} or ${config.swishKeyPath}`)
      )
    }

    // Mutual TLS (mTLS) configuration using merchant certificate, private key, and optional Bankgirot CA
    const options: https.RequestOptions = {
      hostname: targetUrl.hostname,
      port: 443,
      path: targetUrl.pathname,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      cert: fs.readFileSync(config.swishCertPath),
      key: fs.readFileSync(config.swishKeyPath),
      passphrase: 'swish',
      ca: fs.existsSync(config.swishCaPath) ? fs.readFileSync(config.swishCaPath) : undefined,
    }

    // Dispatch the mTLS request using Node's native HTTPS client to support client-certificate authentication
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', async () => {
        // Swish returns 201 Created upon successful registration of the payment request
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          // Token is delivered in the PaymentRequestToken response header
          const rawToken = res.headers['paymentrequesttoken']
          const token = (Array.isArray(rawToken) ? rawToken[0] : rawToken) || ''

          // Generate base64 SVG QR code for desktop shoppers to scan with their mobile Swish app
          const qrSvgUrl = await fetchSwishQrDataUrl(token)

          resolve({
            instructionUUID,
            token,
            qrSvgUrl,
          })
        } else {
          reject(
            new Error(`Swish API rejected with status ${res.statusCode}: ${data || res.statusMessage}`)
          )
        }
      })
    })

    req.on('error', (err) => {
      reject(new Error(`Swish mTLS handshake error: ${err.message}`))
    })

    req.write(payload)
    req.end()
  })
}


export function createSwishRefund(input: SwishRefundInput): Promise<{ refundUUID: string }> {
  return new Promise((resolve, reject) => {
    const config = useRuntimeConfig()
    const isTest = config.swishEnv === 'test'

    const refundUUID = randomUUID().replace(/-/g, '').toUpperCase()
    const amountStr = (input.amountMinorSEK / 100).toFixed(2)

    const payload = JSON.stringify({
      originalPaymentReference: input.originalPaymentReference,
      callbackUrl: config.swishCallbackUrl,
      payerAlias: config.swishPayeeAlias,
      payerPaymentReference: input.payerPaymentReference,
      currency: 'SEK',
      amount: amountStr,
      message: (input.message || 'Prisjustering Siwar').substring(0, 50),
    })

    const targetUrl = new URL(
      isTest
        ? `https://mss.cpc.getswish.net/swish-cpcapi/api/v2/refunds/${refundUUID}`
        : `https://cpc.getswish.net/swish-cpcapi/api/v2/refunds/${refundUUID}`
    )

    if (!fs.existsSync(config.swishCertPath) || !fs.existsSync(config.swishKeyPath)) {
      return reject(
        new Error(`Swish certificates missing at ${config.swishCertPath} or ${config.swishKeyPath}`)
      )
    }

    const options: https.RequestOptions = {
      hostname: targetUrl.hostname,
      port: 443,
      path: targetUrl.pathname,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      cert: fs.readFileSync(config.swishCertPath),
      key: fs.readFileSync(config.swishKeyPath),
      passphrase: 'swish',
      ca: fs.existsSync(config.swishCaPath) ? fs.readFileSync(config.swishCaPath) : undefined,
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        // Swish returns 201 Created on refund registration
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ refundUUID })
        } else {
          reject(
            new Error(`Swish refund failed with status ${res.statusCode}: ${data || res.statusMessage}`)
          )
        }
      })
    })

    req.on('error', (err) => {
      reject(new Error(`Swish mTLS refund handshake error: ${err.message}`))
    })

    req.write(payload)
    req.end()
  })
}