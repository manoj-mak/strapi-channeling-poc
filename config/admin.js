module.exports = ({ env }) => ({
  auth: {
    secret: env("ADMIN_JWT_SECRET"),
  },
  apiToken: {
    salt: env("API_TOKEN_SALT"),
  },
  transfer: {
    token: {
      salt: env("TRANSFER_TOKEN_SALT"),
    },
  },
  flags: {
    nps: env.bool("FLAG_NPS", true),
    promoteEE: env.bool("FLAG_PROMOTE_EE", true),
  },
  security: {
    csrf: true,
    csp: {
      enabled: true,
      policies: {
        "connect-src": [
          "'self'",
          "https:",
          "http://localhost:1338",
          "http://localhost:1337",
        ], // production URL
      },
    },
  },
});
