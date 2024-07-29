export type S3Resource = {
  bucket: string;
  target: string;
  IAM?: {
    ACCESS_KEY_ID: string;
    SECRET_ACCESS_KEY: string;
  };
};
