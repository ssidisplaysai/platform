import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const REQUIRED_SSE = "aws:kms";

function validateBucketName(bucket) {
  if (typeof bucket !== "string" || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
    throw new Error("S3_BUCKET_INVALID");
  }
}

function validateKmsKeyArn(kmsKeyArn) {
  if (typeof kmsKeyArn !== "string" || !/^arn:aws:kms:[a-z0-9-]+:\d{12}:key\/[0-9a-f-]{36}$/i.test(kmsKeyArn)) {
    throw new Error("KMS_KEY_ARN_INVALID");
  }
}

export function buildPutObjectCommand({
  bucket,
  key,
  bodyText,
  kmsKeyArn,
  expectedBucketOwner,
  runId,
}) {
  validateBucketName(bucket);
  validateKmsKeyArn(kmsKeyArn);
  if (typeof key !== "string" || key.length === 0) throw new Error("S3_OBJECT_KEY_INVALID");
  if (typeof bodyText !== "string" || bodyText.length === 0) throw new Error("S3_UPLOAD_BODY_INVALID");
  if (typeof runId !== "string" || runId.length === 0) throw new Error("S3_UPLOAD_RUN_ID_REQUIRED");

  const commandInput = {
    Bucket: bucket,
    Key: key,
    Body: bodyText,
    ServerSideEncryption: REQUIRED_SSE,
    SSEKMSKeyId: kmsKeyArn,
    IfNoneMatch: "*",
    ContentType: "application/json",
    Metadata: {
      "run-id": runId,
      namespace: "share-to-grow-repository",
    },
  };
  if (expectedBucketOwner) commandInput.ExpectedBucketOwner = expectedBucketOwner;
  return commandInput;
}

export async function uploadSnapshotToS3({
  bucket,
  key,
  bodyText,
  kmsKeyArn,
  expectedBucketOwner,
  runId,
  s3Client = new S3Client({}),
}) {
  const input = buildPutObjectCommand({
    bucket,
    key,
    bodyText,
    kmsKeyArn,
    expectedBucketOwner,
    runId,
  });
  try {
    const output = await s3Client.send(new PutObjectCommand(input));
    return {
      eTag: output.ETag ?? null,
      versionId: output.VersionId ?? null,
      serverSideEncryption: output.ServerSideEncryption ?? null,
      sseKmsKeyId: output.SSEKMSKeyId ?? null,
    };
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode;
    const name = typeof error?.name === "string" ? error.name : "";
    const message = typeof error?.message === "string" ? error.message : "";
    if (status === 412 || name === "PreconditionFailed" || message.includes("PreconditionFailed")) {
      throw new Error("S3_OBJECT_ALREADY_EXISTS");
    }
    if (name === "KMSAccessDeniedException" || message.includes("KMS")) {
      throw new Error("KMS_ACCESS_DENIED");
    }
    if (status === 403 || name === "AccessDenied" || message.includes("AccessDenied")) {
      throw new Error("S3_ACCESS_DENIED");
    }
    throw new Error("S3_UPLOAD_FAILED");
  }
}
