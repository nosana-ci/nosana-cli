export type S3Unsecure = { type: 'S3'; url: string; target: string };

export type S3Secure = S3Unsecure & {
  IAM: {
    REGION: string;
    ACCESS_KEY_ID: string;
    SECRET_ACCESS_KEY: string;
  };
};

export type Resource = S3Unsecure | S3Secure;

export type RequiredResource = Omit<Resource, 'target'>;
