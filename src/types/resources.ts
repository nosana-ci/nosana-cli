type S3Resource = {
  bucket: string;
  dest: string;
  IAM?: {
    ACCESS_KEY_ID: string;
    SECRET_ACCESS_KEY: string;
  };
};
