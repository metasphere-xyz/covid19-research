# -*- coding: utf-8 -*-

import arnparse
import boto3
import json
import logging
import os
import time


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

# metadata database configuration
METADATA_DATABASE_NAME = os.getenv('METADATA_DATABASE_NAME')
METADATA_TABLE_NAME = os.getenv('METADATA_TABLE_NAME')
METADATA_ATHENA_QUERY_PATH = os.getenv('METADATA_ATHENA_QUERY_PATH')
ATHENA_WAIT_INTERVAL = 1.0 # in seconds

# metadata to be imported to DynamoDB.
# (DynamoDB attribute name, key in metadata)
METADATA_TO_IMPORT = [
    ('PaperID', 'paper_id'),
    ('Title', 'title'),
    ('Authors', 'authors'),
    ('PublishDate', 'publish_time'),
    ('Journal', 'journal'),
    ('DOI', 'doi'),
    ('License', 'license'),
    ('URL', 'url')
]


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


def parse_query_result_rows(rows):
    """Parses given query result rows.

    Supposes the first item of `rows` represents column names,
    and the secnd item of `rows` represents column values.

    :rtype: dict
    :return: Metadata. An empty dict if no metadata exists.
    """
    if len(rows) < 2:
        return {}
    names = [d['VarCharValue'] for d in rows[0]['Data']]
    values = [d['VarCharValue'] for d in rows[1]['Data']]
    return dict(zip(names, values))


def string_attribute_or_null(s):
    """Makes a string attribute for `Athena:PutItem`.

    Returns a `NULL` attribute if `s` is empty because `Athena:PutItem`
    does not allow an empty string.
    """
    return s and { 'S': s } or { 'NULL': True }


def register_metadata(paper_id, metadata):
    """Registers given metadata to the main table.

    Absent attributes are replaced with `NULL`.

    :type metadata: dict
    :param metadata: Metadata to be registered.
    """
    dynamodb = boto3.client('dynamodb', region_name=MAIN_TABLE_ARN.region)
    item = {
        attr: string_attribute_or_null(metadata.get(key, ''))
            for attr, key in METADATA_TO_IMPORT
    }
    item['Partition'] = {
        'S': 'metadata:%s' % paper_id
    }
    LOGGER.info('putting item: %s', item)
    LOGGER.info(
        'putting item to %s (region=%s)',
        MAIN_TABLE_ARN.resource,
        MAIN_TABLE_ARN.region)
    dynamodb.put_item(
        TableName=MAIN_TABLE_ARN.resource,
        Item=item)


def query_metadata(paper_id):
    """Queries the metadata of a given paper ID.
    """
    athena = boto3.client('athena')
    partition_id = paper_id[0:2]
    query = 'SELECT * FROM "%s" WHERE partition_id=\'%s\' AND paper_id=\'%s\'' % (METADATA_TABLE_NAME, partition_id, paper_id)
    LOGGER.info('query: %s', query)
    res_run = athena.start_query_execution(
        QueryString=query,
        QueryExecutionContext={
            'Database': METADATA_DATABASE_NAME
        },
        ResultConfiguration={
            'OutputLocation': METADATA_ATHENA_QUERY_PATH
        })
    exec_id = res_run['QueryExecutionId']
    while True:
        res_poll = athena.get_query_execution(QueryExecutionId=exec_id)
        status = res_poll['QueryExecution']['Status']
        state = status['State']
        LOGGER.info('query execution state: %s', status)
        if state in ('SUCCEEDED', 'FAILED', 'CANCELLED'):
            break
        time.sleep(ATHENA_WAIT_INTERVAL)
    results = athena.get_query_results(QueryExecutionId=exec_id, MaxResults=2)
    LOGGER.debug(results)
    return parse_query_result_rows(results['ResultSet']['Rows'])


def process_record(record):
    """Processes an S3 event record.

    This function is supposed to be called when an article is put.
    1. Reads the article.
    2. Retrieves the paper ID of the article.
    3. Retrieves the metadata of the paper ID.
    4. Puts the metadata to the main table.
    """
    record_s3 = record['s3']
    bucket_name = record_s3['bucket']['name']
    key = record_s3['object']['key']
    LOGGER.info('bucket=%s, key=%s', bucket_name, key)
    article = load_article(bucket_name, key)
    paper_id = article['paper_id']
    LOGGER.info('paper ID: %s', paper_id)
    metadata = query_metadata(paper_id)
    LOGGER.info('metadata: %s', metadata)
    if not metadata:
        LOGGER.warn('no metadata is found')
        # only title is available
        # TODO: authors may be used but needs treatment
        metadata = {
            'title': article['metadata']['title']
        }
    register_metadata(paper_id, metadata)


def lambda_handler(event, context):
    records = event['Records']
    LOGGER.info('register-function invoked: # records=%d', len(records))
    for record in records:
        process_record(record)
    return {
        'statusCode': 200,
        'message': 'registration done'
    }
