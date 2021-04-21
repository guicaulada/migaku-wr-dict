import argparse
import re

import requests
from bs4 import BeautifulSoup

URL = 'https://www.wordreference.com'

def parse_args():
    parser = argparse.ArgumentParser(prog='migaku-wr-dict',
                                     description='Generate Migaku Dictionaries with WordReference definitions')
    parser.add_argument('--from', type=str, dest='lfrom', required=True,
                        help='The language you want to translate from')
    parser.add_argument('--to', type=str, dest='lto', required=True,
                        help='The language you want to translate to')
    parser.add_argument('--words', '-w', type=str, dest='words',
                        help='Path to word list to translate from')
    parser.add_argument('--freq', '-f', type=str, dest='freq',
                        help='Path to frequency list (optional)')
    parser.add_argument('--debug', action='store_true', dest='debug',
                        help="Print debug output")
    args = parser.parse_args()
    return args


def get_entries_for_term(lfrom, lto, term):
    path = lfrom + lto
    url = f'{URL}/{path}/{term}'
    altterms = []
    pronunciations = []
    definitions = []
    pos = []
    examples = []
    audios = []
    for i in range(0, 1000, 100):
        result = requests.get(url + f'?start={i}')
        soup = BeautifulSoup(result.content, 'html.parser')
        tables = soup.find_all('table', class_='WRD')
        for table in tables:
            entries = table.find_all('tr', class_=['even', 'odd'])
            for entry in entries:
                entry_id = entry.get('id')
                if entry_id and path in entry_id:
                    to_wrd = entry.find('td', class_="ToWrd")
                    definitions
                    print()
            break
        break
    return {
        'term': term,
        'altterms': altterms,
        'pronunciations': pronunciations,
        'definitions': definitions,
        'pos': pos,
        'examples': examples,
        'audios': audios,
    }


def main():
    args = parse_args()
    words = get_entries_for_term(args.lfrom, args.lto, 'long')
    print(words)


if __name__ == '__main__':
    main()
