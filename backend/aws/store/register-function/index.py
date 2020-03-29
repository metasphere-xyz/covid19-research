# -*- coding: utf-8 -*-

import logging


LOGGER = logging.getLogger(__name__)


def lambda_handler (event, context):
    LOGGER.info('register-function invoked')
    return {
        'statusCode': 200,
        'message': 'register-function invoked'
    }
