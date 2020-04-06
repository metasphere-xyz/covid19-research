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
LOG_LEVEL = os.getenv('LOG_LEVEL', DEFAULT_LOG_LEVEL)
LOG_LEVEL = (LOG_LEVEL in ALL_LOG_LEVELS) and LOG_LEVEL or DEFAULT_LOG_LEVEL
LOGGER = logging.getLogger(__name__)
LOGGER.setLevel(getattr(logging, LOG_LEVEL))

# locates the main DynamoDB table
MAIN_TABLE_ARN_TEXT = os.getenv('MAIN_TABLE_ARN')
MAIN_TABLE_ARN = arnparse.arnparse(MAIN_TABLE_ARN_TEXT)

# article bucket
ARTICLE_BUCKET_NAME = os.getenv('ARTICLE_BUCKET_NAME')


def load_article(paper_id):
    """Loads an article associated with a given paper ID.
    """
    s3 = boto3.client('s3')
    key = 'json/%s.json' % paper_id
    LOGGER.info('bucket=%s, key=%s', ARTICLE_BUCKET_NAME, key)
    obj = s3.get_object(
        Bucket=ARTICLE_BUCKET_NAME,
        Key=key)
    body = obj['Body']
    article = json.loads(body.read())
    body.close()
    return article


def get_metadata_column_value(typed_value):
    """Gets a metadata column value.

    Supposes a value is a string, otherwise NULL.
    """
    if 'S' in typed_value:
        return typed_value['S']
    else:
        return None


def parse_metadata(raw_metadata):
    """Parses given metadata.
    """
    return {
        key: get_metadata_column_value(value)
            for key, value in raw_metadata.items() if key != 'Partition'
    }


def query_metadata(paper_id):
    """Queries metadata of a given paper ID.
    """
    dynamodb = boto3.client('dynamodb', region_name=MAIN_TABLE_ARN.region)
    key = {
        'Partition': {
            'S': 'metadata:%s' % paper_id
        }
    }
    response = dynamodb.get_item(
        TableName=MAIN_TABLE_ARN.resource,
        Key=key)
    return parse_metadata(response['Item'])


def lambda_handler(event, context):
    # 1. Loads an article of the paper ID
    # 2. Queries metadata of the paper ID
    # 3. Embeds metadata in article as metadata2
    LOGGER.info('get article invoked: %s', event)
    paper_id = event['paperId']
    LOGGER.info('loading article: %s', paper_id)
    article = load_article(paper_id)
    LOGGER.debug('article: %s', article)
    LOGGER.info('querying metadata: %s', paper_id)
    metadata = query_metadata(paper_id)
    LOGGER.debug('metadata: %s', metadata)
    # merges article and metadata
    article['metadata2'] = metadata
    return article
