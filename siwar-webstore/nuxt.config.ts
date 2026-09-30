// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  srcDir: '.',
  devtools: { enabled: true },

  typescript: {
    strict: true,
    typeCheck: true,
    builder: 'shared',
  },

  runtimeConfig: {
    mongodbUri: process.env.MONGODB_URI,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    swishPayeeAlias: process.env.SWISH_PAYEE_ALIAS,
    swishCertPath: process.env.SWISH_CERT_PATH,
    swishKeyPath: process.env.SWISH_KEY_PATH,
    swishCaPath: process.env.SWISH_CA_PATH,
    swishCallbackUrl: process.env.SWISH_CALLBACK_URL,
    swishEnv: process.env.SWISH_ENVIRONMENT || 'test',

    // Private keys accessible strictly on the server side
    r2AccountId: process.env.R2_ACCOUNT_ID || '',
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    r2BucketName: process.env.R2_BUCKET_NAME || '',
    public: {
      // Public CDN base URL accessible to client and server
      r2PublicUrl: process.env.R2_PUBLIC_URL || '',

      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
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
