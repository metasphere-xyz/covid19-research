#!/usr/bin/env python3
import argparse
import logging as log
import hashlib
import time
import pydgraph
from datetime import datetime
import csv

# flask

# logging
from logging.config import dictConfig

dictConfig({
    'version': 1,
    'formatters': {'default': {
        'format': '[%(asctime)s] %(levelname)s in %(module)s: %(message)s',
    }},
    'handlers': {'wsgi': {
        'class': 'logging.StreamHandler',
        'stream': 'ext://sys.stdout',
        'formatter': 'default'
    }},
    'root': {
        'level': 'INFO',
        'handlers': ['wsgi']
    }
})

#   _______     ______   ________
#  |_   __ \   |_   _ `.|_   __  |
#    | |__) |    | | `. \ | |_ \_|
#    |  __ /     | |  | | |  _|
#   _| |  \ \_  _| |_.' /_| |_
#  |____| |___||______.'|_____|
#


def _rdf(s, p, o):
    if _empty(s) or _empty(p) or _empty(o):
        return None
    if isinstance(o, datetime):
        o = o.isoformat("T")
    o = str(o)
    if not o.startswith("_:"):
        o = o.replace('"', "'")
        o = o.replace('\\', "-")
        o = o.replace("\n", "<br>").replace("\r", "")
        o = f'"{o}"'
    return f"{s} <{p}> {o} ."


def _blank_node(n):
    """
    return an hash of the input string as a blanc node uid
    """
    if _empty(n):
        return None
    h = hashlib.sha224(str(n).strip().encode()).hexdigest()
    return f"_:{h}"


def _v(obj, prop, default=None):
    val = getattr(obj, prop, default)
    if callable(val):
        return val.__call__()
    return default if _empty(val) else val


def _empty(o):
    if o is None or len(str(o)) == 0:
        return True
    return False


class Dataset(object):
    def __init__(self, tenant=None):
        self.triples = []
        self.blanks = {}
        self.tenant = tenant

    def _chkuid(self, uid_data):
        """
        return (uid, exists)
        """
        _uid = _blank_node(uid_data)
        if _uid is None:
            raise ValueError(f"SKIP-EMPTY {uid_data}")
        if _uid in self.blanks:
            return _uid, True
        self.blanks[_uid] = uid_data
        return _uid, False

    def _add_predicates(self, _uid, *predicates):
        for st in predicates:
            if len(st) > 2:
                # reverse predicate (is object)
                self.push(st[0], st[1], _uid)
            else:
                # uid is subject
                self.push(_uid, st[0], st[1])

    def record(self, element: dict, uid_key: str, *predicates):
        """
        Transform a record to RDF

        Args:
        - element(dict): the record to save
        - uid_key(string): the key in the elment dict that will be used for uid
        - *predicates([tuple]): list of additional predicates to add for the element
        """
        log.debug(f"line {element}")
        try:
            _uid, exists = self._chkuid(_v(element, uid_key))
            # load only additional predicates
            self._add_predicates(_uid, *predicates)
            # otherwise skip
            if exists:
                return
            for k, v in element.items():
                self.push(_uid, k, v)
        except ValueError as e:
            log.error(f"error {e} - element {element}: uid_key {uid_key}")

    def push(self, s, p, o):
        t = _rdf(s, p, o)
        if t is not None:
            self.triples.append(t)

    def save(self, outfile="triples.rdf"):
        """
        saves both the triples file and the mapping between blank nodes uid and value
        """
        records = 0
        with open(outfile, "w") as fp:
            for t in self.triples:
                fp.write(f"{t}\n")
                records += 1
            fp.flush()
        with open(f"{outfile}.blanks.tsv", "w") as fp:
            for k, v in self.blanks.items():
                fp.write(f"{k}\t{v}\n")
            fp.flush()
        return records

    def saveMutation(self, outfile="triples.mut.rdf"):
        with open(outfile, "w") as fp:
            fp.write("{ set {\n")
            for t in self.triples:
                fp.write(f"{t}\n")
            fp.write("} }\n")
            fp.flush()

    def loadRDF(self, filename="triples.rdf"):
        with open(filename) as fp:
            count = 0
            for line in fp:
                if not _empty(line):
                    self.triples.append(line.strip())
                    count += 1
            log.info(f"loaded {count} lines")

    def publish(self, dgraphServerAddress="localhost:9080"):
        client_stub = pydgraph.DgraphClientStub(dgraphServerAddress)
        client = pydgraph.DgraphClient(client_stub)
        txn = client.txn()
        try:
            response = txn.mutate(set_nquads="\n".join(self.triples))
            txn.commit()
            print(response)
        finally:
            txn.discard()


#   ________  _____  _____  ____  _____   ______
#  |_   __  ||_   _||_   _||_   \|_   _|.' ___  |
#    | |_ \_|  | |    | |    |   \ | | / .'   \_|
#    |  _|     | '    ' |    | |\ \| | | |
#   _| |_       \ \__/ /    _| |_\   |_\ `.___.'\
#  |_____|       `.__.'    |_____|\____|`.____ .'
#

def publish(dataset_file):
    d = Dataset()
    d.loadRDF(dataset_file)
    d.publish()


def csv2triples(in_file, out_file, uid_field="Document_No"):
    d = Dataset()
    with open(in_file) as fp:
        rows = csv.DictReader(fp, delimiter=',', quotechar='"')
        for row in rows:
            d.record(row, uid_key=uid_field)
    d.save(out_file)

#     ______  ____    ____  ______     ______
#   .' ___  ||_   \  /   _||_   _ `. .' ____ \
#  / .'   \_|  |   \/   |    | | `. \| (___ \_|
#  | |         | |\  /| |    | |  | | _.____`.
#  \ `.___.'\ _| |_\/_| |_  _| |_.' /| \____) |
#   `.____ .'|_____||_____||______.'  \______.'
#


def cmd_csv2triples(args=None):
    log.info(f"processing data from {args.CSV_PATH} into {args.output}")
    # start the token process
    csv2triples(args.CSV_PATH, args.output)
    # instantiate the cache


def cmd_dataset_publish(args=None):
    log.info(f"publish dataset from {args.file}")
    start = time.time()
    publish(args.file)
    log.info(f"dataset published in {time.time() - start}tu: {args.file} ")


if __name__ == '__main__':
    commands = [
        {
            'name': 'c2t',
            'help': 'transform an output of the topic modeling to RDF triples',
            'target': cmd_csv2triples,
            'opts': [
                {
                    "names": ["CSV_PATH"],
                    "help": "path to the csv file to parse",
                },
                {
                    "names": ["-o", "--output"],
                    "help": "path to the output file (default triples.rdf)",
                    "default": "triples.rdf",
                },
            ]
        },
        {
            'name': 'publish',
            'help': 'publish a dataset from a triples file',
            'target': cmd_dataset_publish,
            'opts': [
                {
                    "names": ["-f", "--file"],
                    "help": "triples file to load  (default triples.rdf)",
                    "default": "triples.rdf"
                },
                {
                    "names": ["-h", "--dgraph-host"],
                    "help": "host and port of the dgraph grpc interface (default localhost:9080)",
                    "default": "localhost:9080"
                },

            ]

        }
    ]
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers()
    subparsers.required = True
    subparsers.dest = 'command'
    # register all the commands
    for c in commands:
        subparser = subparsers.add_parser(c['name'], help=c['help'])
        subparser.set_defaults(func=c['target'])
        # add the sub arguments
        for sa in c.get('opts', []):
            subparser.add_argument(*sa['names'],
                                   help=sa['help'],
                                   action=sa.get('action'),
                                   default=sa.get('default'))

    # parse the arguments
    args = parser.parse_args()
    # call the function
    args.func(args)
