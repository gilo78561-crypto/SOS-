export { default } from '@sos/api/serverless';

export const config = {
  api: {
    // Nest handles body parsing, including the original bytes for signed webhooks.
    bodyParser: false,
    externalResolver: true,
  },
  maxDuration: 30,
};
