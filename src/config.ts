export const config = (
  await import(
    `./config/${process.env.APP_ENV || process.env.NODE_ENV || 'production'}.js`
  )
).config;
