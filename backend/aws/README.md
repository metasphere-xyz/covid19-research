# Backend AWS

To run commands listed below, you need to supply an appropriate credential; e.g., by `--profile` option.

## Preparing an article bucket

1. Deploy a CloudFormation stack by [`store/article-bucket.yaml`](store/article-bucket.yaml).

    ```
    aws cloudformation deploy --template-file store/article-bucket.yaml --stack-name covid-19-article-bucket-devel
    ```

2. A new empty bucket will be created.

3. Remember the bucket name.

    ```
    ARTICLE_BUCKET=`aws --query "Stacks[0].Outputs[?OutputKey=='ArticleBucketName']|[0].OutputValue" cloudformation describe-stacks --stack-name covid-19-article-bucket-devel | sed 's/^"//; s/"$//'`
    ```

   **Details**
    - The query `Stacks[0].Outputs[?OutputKey=='ArticleBucketName']|[0].OutputValue` extracts the `ArticleBucketName` output value of the stack.
    - The command `sed 's/^"//; s/"$//'` removes surrounding quotations (`'`).
    - The bucket name will be stored in `ARTICLE_BUCKET`.

## Creating REST API stack

1. [Prepare an article bucket](#preparing-an-article-bucket) if it is not yet done.

2. Deplay a CloudFormation stack by [`api/api-template.yaml`](api/api-template.yaml).

    ```
    aws cloudformation deploy --template-file api/api-template.yaml --stack-name covid-19-api-devel --parameter-overrides ArticleBucketName=$ARTICLE_BUCKET --capabilities CAPABILITY_IAM
    ```