module.exports = {
  apps: [
    {
      name: "api",
      script: "node_modules/tsx/dist/cli.mjs",
      args: "apps/api/src/server.ts",
      cwd: "C:/LegalBahi",
      env: {
        NODE_ENV: "production",
        JWT_SECRET: "legalbahi_super_secret_jwt_key_2026_xyz_123",
        CORS_ORIGINS: "https://app.legalbhai.com,https://api.legalbhai.com",
        DATABASE_URL: "postgresql://postgres@127.0.0.1:5432/legalbahi",
        PUBLIC_API_URL: "https://api.legalbhai.com",
        PUBLIC_WEB_URL: "https://app.legalbhai.com",
        PILOT_ADMIN_SECRET: "legalbahi_super_secret_admin_key_2026_xyz_123_456",
        TWILIO_ACCOUNT_SID: "AC3df2e400683aa75d9bff3e3e075cc504",
        TWILIO_AUTH_TOKEN: "136e1f5a8d97169ed741cb8f91155f53",
        TWILIO_SMS_FROM: "+16012109282",
        RESEND_API_KEY: "re_JQn1DdgL_FuSyjLEgqyW8vD9o7MT8FeoQ",
        RESEND_FROM_EMAIL: "onboarding@resend.dev",
        R2_ACCOUNT_ID: "f097a687245ae8d82f954c38ce1ef318",
        R2_ACCESS_KEY_ID: "868111aaff390e3a61e11c2e66ff6c02",
        R2_SECRET_ACCESS_KEY: "b0845acc95a90785280e4141fa28affd373b78f07bf4bfe068bf78acf543d7a9",
        R2_DOCUMENT_BUCKET: "legal-bhai",
        R2_BACKUP_BUCKET: "legal-bhai-backups",
        BACKUP_AGE_RECIPIENT: "age10000000000000000000000000000000000000000000000000000000000",
        SENTRY_DSN: "https://dummy@o0.ingest.sentry.io/0",
        IHC_SYNC_ENABLED: "true",
        TRUST_PROXY_LOOPBACK: "true",
        PORT: "3001",
        HOST: "0.0.0.0"
      }
    },
    {
      name: "worker",
      script: "node_modules/tsx/dist/cli.mjs",
      args: "apps/api/src/worker.ts",
      cwd: "C:/LegalBahi",
      env: {
        NODE_ENV: "production",
        JWT_SECRET: "legalbahi_super_secret_jwt_key_2026_xyz_123",
        CORS_ORIGINS: "https://app.legalbhai.com,https://api.legalbhai.com",
        DATABASE_URL: "postgresql://postgres@127.0.0.1:5432/legalbahi",
        PUBLIC_API_URL: "https://api.legalbhai.com",
        PUBLIC_WEB_URL: "https://app.legalbhai.com",
        PILOT_ADMIN_SECRET: "legalbahi_super_secret_admin_key_2026_xyz_123_456",
        TWILIO_ACCOUNT_SID: "AC3df2e400683aa75d9bff3e3e075cc504",
        TWILIO_AUTH_TOKEN: "136e1f5a8d97169ed741cb8f91155f53",
        TWILIO_SMS_FROM: "+16012109282",
        RESEND_API_KEY: "re_JQn1DdgL_FuSyjLEgqyW8vD9o7MT8FeoQ",
        RESEND_FROM_EMAIL: "onboarding@resend.dev",
        R2_ACCOUNT_ID: "f097a687245ae8d82f954c38ce1ef318",
        R2_ACCESS_KEY_ID: "868111aaff390e3a61e11c2e66ff6c02",
        R2_SECRET_ACCESS_KEY: "b0845acc95a90785280e4141fa28affd373b78f07bf4bfe068bf78acf543d7a9",
        R2_DOCUMENT_BUCKET: "legal-bhai",
        R2_BACKUP_BUCKET: "legal-bhai-backups",
        BACKUP_AGE_RECIPIENT: "age10000000000000000000000000000000000000000000000000000000000",
        SENTRY_DSN: "https://dummy@o0.ingest.sentry.io/0",
        IHC_SYNC_ENABLED: "true",
        TRUST_PROXY_LOOPBACK: "true",
        PORT: "3001",
        HOST: "0.0.0.0"
      }
    },
    {
      name: "web",
      script: "C:\\Progra~1\\nodejs\\npm.cmd",
      args: "run start:web",
      cwd: "C:/LegalBahi",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};