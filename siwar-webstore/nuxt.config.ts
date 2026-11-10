// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  srcDir: '.',
  devtools: { enabled: true },

  typescript: {
    strict: true,
    typeCheck: false,
    builder: 'shared',
  },

  postcss: {
    plugins: {
      'tailwindcss/nesting': false,
    },
  },

  runtimeConfig: {
    mongodbUri: process.env.MONGODB_URI || process.env.MONGO_URL || process.env.MONGODB_URL || process.env.DATABASE_URL || '',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    swishPayeeAlias: process.env.SWISH_PAYEE_ALIAS,
    swishCertPath: process.env.SWISH_CERT_PATH,
    swishKeyPath: process.env.SWISH_KEY_PATH,
    swishCaPath: process.env.SWISH_CA_PATH,
    swishCallbackUrl: process.env.SWISH_CALLBACK_URL,
    swishEnv: process.env.SWISH_ENVIRONMENT || 'test',

    // Email Service (Resend)
    resendApiKey: process.env.RESEND_API_KEY || process.env.MAIL_API_KEY || '',
    mailFrom: process.env.MAIL_FROM || process.env.MAIL_FROM_ADDRESS || 'Siwar Webstore <order@siwar.se>',
    storeEmail: process.env.STORE_EMAIL || '',

    // DHL Freight Sweden Logistics (Product 103 Servicepoint)
    dhlClientKey: process.env.DHL_CLIENT_KEY || '',
    dhlAccountNumber: process.env.DHL_ACCOUNT_NUMBER || '',
    dhlEnvironment: (process.env.DHL_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
    dhlApiFarmSandbox: process.env.DHL_API_FARM_SANDBOX || 'https://test-api.freight-logistics.dhl.com',
    dhlApiFarmProduction: process.env.DHL_API_FARM_PRODUCTION || 'https://api.freight-logistics.dhl.com',

    // Private keys accessible strictly on the server side
    r2AccountId: process.env.R2_ACCOUNT_ID || '',
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    r2BucketName: process.env.R2_BUCKET_NAME || '',
    public: {
      // Public CDN base URL accessible to client and server
      r2PublicUrl: process.env.R2_PUBLIC_URL || '',

      stripePublishableKey: process.env.NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY || '',
    },
  },

  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@nuxtjs/i18n',
    '@nuxt/icon',
  ],

  i18n: {
    langDir: 'locales',
    defaultLocale: 'ar',
    strategy: 'prefix_and_default',
    locales: [
      { code: 'ar', iso: 'ar-SA', file: 'ar.json', name: 'العربية', dir: 'rtl' },
      { code: 'en', iso: 'en-US', file: 'en.json', name: 'English', dir: 'ltr' },
      { code: 'sv', iso: 'sv-SE', file: 'sv.json', name: 'Svenska', dir: 'ltr' },
    ]
  },
})
