# -*- coding: utf-8 -*-

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


def lambda_handler (event, context):
    global LOGGER
    LOGGER.info('register-function invoked')
    return {
        'statusCode': 200,
        'message': 'register-function invoked'
    }
