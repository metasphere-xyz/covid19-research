#!/usr/bin/env python
# -*- coding: utf-8 -*-

import argparse
import arnparse
import boto3
import glob
import logging
import os
import time


LOGGER = None


def metadata_exists(dynamodb, table_name, paper_id):
    """Returns whether a given paper ID exists in the main DynamoDB table.
    """
    key = {
        'Partition': {
            'S': 'metadata:%s' % paper_id
        }
    }
    result = dynamodb.get_item(TableName=table_name, Key=key)
    LOGGER.debug(result)
    return 'Item' in result


def upload_article(s3, article_path, bucket, key):
    """Uploads a given article.
    """
    s3.upload_file(article_path, Bucket=bucket, Key=key)


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    LOGGER = logging.getLogger(__name__)
    arg_parser = argparse.ArgumentParser(
        description='Uploads given articles to an S3 bucket and DynamoDB')
    arg_parser.add_argument(
        '--profile', type=str, required=True,
        help='name of an AWS profile to access an S3 bucket')
    arg_parser.add_argument(
        '--bucket', type=str, required=True,
        help='name of an S3 bucket to which articles are to be uploaded')
    arg_parser.add_argument(
        '--folder', type=str, default='json',
        help='path to the folder to which articles are to be uploaded.'
             ' "json" by default')
    arg_parser.add_argument(
        '--main-table', dest='main_table_arn', metavar='MAIN_TABLE_ARN',
        type=str, required=True,
        help='ARN of the main DynamodDB table')
    arg_parser.add_argument(
        '--interval', type=float, default=0.25,
        help='interval in seconds between two upload sessions. 0.25 by default')
    arg_parser.add_argument(
        '--overrides', action='store_true',
        help='whether articles in an S3 bucket are overridden.'
             ' by default, an existing article is not updated'
             ' if it is in a main DynamoDB table')
    arg_parser.add_argument(
        'patterns', metavar='PATTERNS', type=str, nargs='+',
        help='glob patterns to locate articles')
    args = arg_parser.parse_args()
    LOGGER.info(
        'profile=%s, bucket=%s, folder=%s, main-table=%s, interval=%f, overrides=%s',
        args.profile,
        args.bucket,
        args.folder,
        args.main_table_arn,
        args.interval,
        args.overrides)
    session = boto3.Session(profile_name=args.profile)
    s3 = session.client('s3')
    dynamodb = session.client('dynamodb')
    table_name = arnparse.arnparse(args.main_table_arn).resource
    for pattern in args.patterns:
        LOGGER.info('globbing: %s', pattern)
        for path in glob.iglob(pattern):
            _, name = os.path.split(path)
            paper_id, _ = os.path.splitext(name)
            key = '%s/%s' % (args.folder, name)
            pushes = args.overrides
            if not pushes:
                LOGGER.info('checking if metadata exists: %s', paper_id)
                pushes = not metadata_exists(
                    dynamodb,
                    table_name=table_name,
                    paper_id=paper_id)
            if pushes:
                LOGGER.info('uploading: %s → %s', name, key)
                upload_article(
                    s3,
                    article_path=path,
                    bucket=args.bucket,
                    key=key)
            else:
                LOGGER.info('skipping: %s', name)
            time.sleep(args.interval)
