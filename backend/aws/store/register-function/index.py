# -*- coding: utf-8 -*-

import arnparse
import boto3
import json
import logging
import os


# configures the logger
ALL_LOG_LEVELS = [
    'NOTSET',
    'DEBUG',
    'INFO',
    'WARNING',
    'ERROR',
    'CRITICAL'
]
DEFAULT_LOG_LEVEL = 'INFO'
LOG_LEVEL = os.getenv('LAMBDA_LOG_LEVEL', DEFAULT_LOG_LEVEL)
LOG_LEVEL = (LOG_LEVEL in ALL_LOG_LEVELS) and LOG_LEVEL or DEFAULT_LOG_LEVEL
LOGGER = logging.getLogger(__name__)
LOGGER.setLevel(getattr(logging, LOG_LEVEL))

# locates the main DynamoDB table
MAIN_TABLE_ARN_TEXT = os.getenv('MAIN_TABLE_ARN')
MAIN_TABLE_ARN = arnparse.arnparse(MAIN_TABLE_ARN_TEXT)


class StreamingBody(object):
    """Makes a given StreamingBody a context manager.
    """
    def __init__(self, body):
        self.body = body

    def __enter__(self):
        """Returns the underlying StreamingBody.
        """
        return self.body

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Closes the underlying StreamingBody.
        """
        self.body.close()


def load_article(bucket_name, key):
    """Loads an article associated with a given bucket and key.

    :rtype: dict
    :return: parsed JSON object of the article.
    """
    s3 = boto3.client('s3')
    s3_object = s3.get_object(Bucket=bucket_name, Key=key)
    with StreamingBody(s3_object['Body']) as body_in:
        body = body_in.read()
    return json.loads(body)


def register_article(article):
    """Registers a given article to the main table.
    """
    dynamodb = boto3.client('dynamodb', region_name=MAIN_TABLE_ARN.region)
    metadata = article['metadata']
    item = {
        'Partition': {
            'S': 'article:%s' % article['paper_id']
        },
        'Title': {
            'S': metadata['title']
        }
    }
    LOGGER.info(
        'putting item to %s (region=%s)',
        MAIN_TABLE_ARN.resource,
        MAIN_TABLE_ARN.region)
    dynamodb.put_item(
        TableName=MAIN_TABLE_ARN.resource,
        Item=item)


def process_record(record):
    """Processes an S3 event record.

    This function is supposed to be called when an article is put.
    1. Reads the article.
    2. Puts the article information to the main table.
    """
    record_s3 = record['s3']
    bucket_name = record_s3['bucket']['name']
    key = record_s3['object']['key']
    LOGGER.info('bucket=%s, key=%s', bucket_name, key)
    article = load_article(bucket_name, key)
    LOGGER.info('paper ID: %s', article['paper_id'])
    register_article(article)


def lambda_handler(event, context):
    records = event['Records']
    LOGGER.info('register-function invoked: # records=%d', len(records))
    for record in records:
        process_record(record)
    return {
        'statusCode': 200,
        'message': 'registration done'
    }
