// VACHAN on AWS: crawl PARIVESH minutes -> read each PDF with Bedrock -> publish static JSON behind CloudFront.
import * as cdk from "aws-cdk-lib";
import * as budgets from "aws-cdk-lib/aws-budgets";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as path from "path";

const app = new cdk.App();
const stack = new cdk.Stack(app, "Vachan", { env: { region: "ap-south-1" } });

// Storage: source PDFs, text, and the JSON the website reads.
const bucket = new s3.Bucket(stack, "Data", {
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  cors: [{ allowedMethods: [s3.HttpMethods.GET], allowedOrigins: ["*"] }],
});
const cdn = new cloudfront.Distribution(stack, "Cdn", {
  defaultBehavior: {
    origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
    responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS,
  },
});
const table = new dynamodb.TableV2(stack, "Extractions", {
  partitionKey: { name: "key", type: dynamodb.AttributeType.STRING },     // proposal number
  sortKey: { name: "sha256", type: dynamodb.AttributeType.STRING },       // minutes PDF
});

// One container image (Python + pdftotext) for every pipeline step.
const image = (cmd: string) =>
  lambda.DockerImageCode.fromImageAsset(path.join(__dirname, "../../pipeline"), { cmd: [cmd] });
const step = (id: string, cmd: string, timeoutMin: number, memoryMb: number) => {
  const fn = new lambda.DockerImageFunction(stack, id, {
    code: image(cmd),
    timeout: cdk.Duration.minutes(timeoutMin),
    memorySize: memoryMb,
    environment: { BUCKET: bucket.bucketName, TABLE: table.tableName, CDN_URL: `https://${cdn.distributionDomainName}` },
  });
  bucket.grantReadWrite(fn);
  table.grantReadWriteData(fn);
  return fn;
};
const crawl = step("Crawl", "vachan.crawl.handler", 15, 1024);
const readPdf = step("Process", "vachan.process.handler", 15, 2048);
const publish = step("Publish", "vachan.publish.handler", 5, 1024);
const proof = step("Proof", "vachan.proof.handler", 15, 2048);
readPdf.addToRolePolicy(new iam.PolicyStatement({
  actions: ["bedrock:InvokeModel"],
  resources: ["arn:aws:bedrock:*::foundation-model/*", `arn:aws:bedrock:*:${stack.account}:inference-profile/*`],
}));

// Pipeline: crawl -> read every new PDF in parallel -> publish.
const readEach = new sfn.DistributedMap(stack, "ReadEachMinutes", {
  itemReader: new sfn.S3JsonItemReader({ bucket, key: "index/todo.json" }),
  maxConcurrency: 4,                 // Nova Pro allows 50 requests a minute
  toleratedFailurePercentage: 10,    // one broken PDF must not stop the run
  resultPath: sfn.JsonPath.DISCARD,
});
readEach.itemProcessor(new tasks.LambdaInvoke(stack, "ReadMinutes", { lambdaFunction: readPdf, payloadResponseOnly: true })
  .addRetry({ errors: ["States.ALL"], maxAttempts: 2, backoffRate: 3, interval: cdk.Duration.seconds(20) }));
const pipeline = new sfn.StateMachine(stack, "Pipeline", {
  definitionBody: sfn.DefinitionBody.fromChainable(
    new tasks.LambdaInvoke(stack, "CrawlParivesh", { lambdaFunction: crawl, payloadResponseOnly: true, resultPath: "$.crawl" })
      .next(readEach)
      .next(new tasks.LambdaInvoke(stack, "PublishJson", { lambdaFunction: publish, payloadResponseOnly: true }))
      .next(new tasks.LambdaInvoke(stack, "ProveQuotes", { lambdaFunction: proof, payloadResponseOnly: true }))),
  timeout: cdk.Duration.hours(3),
});
new events.Rule(stack, "Nightly", {
  schedule: events.Schedule.cron({ hour: "20", minute: "30" }), // 02:00 IST
  targets: [new targets.SfnStateMachine(pipeline)],
});

// Public letter drafting: no login, so it is capped (2 at a time, DAILY_CAP a day).
const letter = step("Letter", "vachan.letter.handler", 1, 512);
letter.addEnvironment("DAILY_CAP", "1500"); // about $0.003 a letter: the worst case is about $4.50 a day
letter.addToRolePolicy(new iam.PolicyStatement({
  actions: ["bedrock:InvokeModel"],
  resources: ["arn:aws:bedrock:*::foundation-model/*", `arn:aws:bedrock:*:${stack.account}:inference-profile/*`],
}));
(letter.node.defaultChild as lambda.CfnFunction).reservedConcurrentExecutions = 2;
const letterUrl = letter.addFunctionUrl({
  authType: lambda.FunctionUrlAuthType.NONE,
  cors: { allowedOrigins: ["*"], allowedMethods: [lambda.HttpMethod.POST], allowedHeaders: ["content-type"] },
});

// Spend guard: at $50 actual spend, AWS Budgets attaches a deny policy to every Lambda role.
// (The $60 budget itself and its e-mail alerts were made once with the CLI.)
const stopSpending = new iam.ManagedPolicy(stack, "StopSpending", {
  statements: [new iam.PolicyStatement({
    effect: iam.Effect.DENY,
    actions: ["bedrock:InvokeModel", "textract:*", "states:StartExecution"],
    resources: ["*"],
  })],
});
const budgetsRole = new iam.Role(stack, "BudgetsActionRole", {
  assumedBy: new iam.ServicePrincipal("budgets.amazonaws.com"),
  inlinePolicies: { attach: new iam.PolicyDocument({ statements: [new iam.PolicyStatement({
    actions: ["iam:AttachRolePolicy", "iam:DetachRolePolicy"], resources: ["*"],
  })] }) },
});
new budgets.CfnBudgetsAction(stack, "StopAt50", {
  budgetName: "vachan-hackathon-60usd",
  actionType: "APPLY_IAM_POLICY",
  actionThreshold: { type: "ABSOLUTE_VALUE", value: 50 },
  notificationType: "ACTUAL",
  approvalModel: "AUTOMATIC",
  executionRoleArn: budgetsRole.roleArn,
  definition: { iamActionDefinition: {
    policyArn: stopSpending.managedPolicyArn,
    roles: [crawl, readPdf, publish, proof, letter].map((fn) => fn.role!.roleName),
  } },
  subscribers: [{ type: "SNS", address: `arn:aws:sns:us-east-1:${stack.account}:vachan-budget-alerts` }],
});

new cdk.CfnOutput(stack, "LetterUrl", { value: letterUrl.url });
new cdk.CfnOutput(stack, "CdnUrl", { value: `https://${cdn.distributionDomainName}` });
new cdk.CfnOutput(stack, "BucketName", { value: bucket.bucketName });
new cdk.CfnOutput(stack, "PipelineArn", { value: pipeline.stateMachineArn });
