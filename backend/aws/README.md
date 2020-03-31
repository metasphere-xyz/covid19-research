# Backend AWS

To run commands listed below, you need to supply an appropriate credential; e.g., by [`--profile` option](https://docs.aws.amazon.com/cli/latest/reference/#options).

## Prerequistes

You need the following software installed,
- [AWS CLI](https://aws.amazon.com/cli/)
- [AWS SAM](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/what-is-sam.html)

## Preparing a bucket for template artifacts

1. Deploy a CloudFormation stack by [`store/template-bucket.yaml`](store/template-bucket.yaml).

    ```
    aws cloudformation deploy --template-file store/template-bucket.yaml --stack-name covid-19-template-bucket
    ```

2. A new empyt bucket will be created.

3. Remember the bucket name.

    ```
    TEMPLATE_BUCKET=`aws --query "Stacks[0].Outputs[?OutputKey=='TemplateBucketName']|[0].OutputValue" cloudformation describe-stacks --stack-name covid-19-template-bucket | sed 's/^"//; s/"$//'`
    ```

    **Details**
    - The query `Stacks[0].Outputs[?OutputKey=='TemplateBucketName']|[0].OutputValue` extracts the `TemplateBucketName` output value of the stack.
    - The command `sed 's/^"//; s/"$//'` removes quotation (`'`).
    - The bucket name will be stored in `TEMPLATE_BUCKET`.

## Preparing a main table

1. Deploy a CloudFormation stack by [`store/main-table.yaml`](store/main-table.yaml)

    ```
    aws cloudformation deploy --template-file store/main-table.yaml --stack-name covid-19-main-table-devel
    ```

2. A new empty DynamoDB table will be created.

3. Remember the ARN of the main table.

    ```
    MAIN_TABLE_ARN=`aws --query "Stacks[0].Outputs[?OutputKey=='MainTableArn']|[0].OutputValue" cloudformation describe-stacks --stack-name covid-19-main-table-devel | sed 's/^"//; s/"$//'`
    ```

    **Details**
    - The query `Stacks[0].Outputs[?OutputKey=='MainTableArn']|[0].OutputValue` extracts the `MainTableArn` output value of the stack.
    - The command `sed 's/^"//; s/"$//'` removes quotation (`'`).
    - The bucket name will be stored in `MAIN_TABLE_ARN`.

## Preparing an article bucket

### Generating a unique name for an article bucket

As long as we let CloudFormation name our resources, they should be unique.
Unfortunately some interwoven resources like an S3 bucket and Lambda functions need predetermined names.
The article bucket is one of them.
Since we need a globally unique bucket name, I recommend you to append a random number to your bucket name.

1. Combine a prefix and a random suffix.

    ```
    ARTICLE_BUCKET=covid-19-article-bucket-`openssl rand -hex 4`
    ```

If you already created a CloudFormation stack, you can do the following,

```
ARTICLE_BUCKET=`aws --query "Stacks[0].Outputs[?OutputKey=='ArticleBucketName']|[0].OutputValue" cloudformation describe-stacks --stack-name covid-19-article-bucket-devel | sed 's/^"//; s/"$//'`
```

### Preparing Python virtual environment

Python scripts for Lambda functions may need to import additional packages.
To include additional packages in a Lambda function, those packages need to be listed in a `requirements.txt` file.
The easiest way to list packages is to run `pip freeze`.

```
pip freeze > requirements.txt
```

However it lists all of packages globally installed.
To list only packages necessary for a Lambda function, it is recommended to make a virtual environment dedicated to the Lambda function.

```
python -m venv ./venv
. ./venv/bin/activate
```

### Creating an article bucket

1. Build a SAM template [`store/article-bucket.yaml`](store/article-bucket.yaml).

    ```
    sam build --use-container --template store/article-bucket.yaml --build-dir store/build
    ```

2. Package a SAM template [`store/article-bucket.yaml`](store/article-bucket.yaml).

    ```
    sam package --template-file store/build/template.yaml --output-template-file store/article-bucket-packaged.yaml --s3-bucket $TEMPLATE_BUCKET
    ```

3. Deploy a CloudFormation stack by [`store/article-bucket.yaml`](store/article-bucket.yaml).

    ```
    aws cloudformation deploy --template-file store/article-bucket-packaged.yaml --stack-name covid-19-article-bucket-devel --parameter-overrides ArticleBucketName=$ARTICLE_BUCKET MainTableArn=$MAIN_TABLE_ARN --capabilities CAPABILITY_IAM
    ```

4. A new empty bucket and Lambda functions will be created.

## Creating a REST API stack

1. [Prepare an article bucket](#preparing-an-article-bucket) if it is not yet done.

2. Deplay a CloudFormation stack by [`api/api-template.yaml`](api/api-template.yaml).

    ```
    aws cloudformation deploy --template-file api/api-template.yaml --stack-name covid-19-api-devel --parameter-overrides ArticleBucketName=$ARTICLE_BUCKET --capabilities CAPABILITY_IAM
    ```

## Deploying a REST API

Deployment of a REST API is not automated yet.
You need to manually deploy the API.