import argparse
import json
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
                        help='Print debug output')
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
    result = requests.get(url)
    soup = BeautifulSoup(result.content, 'html.parser')
    top = soup.find('div', class_='pwrapper')
    pron = top.find_all('span', class_=['pronWR', 'pronRH'])
    table = soup.find('table', class_='WRD')
    entries = table.find_all('tr', class_=['even', 'odd'])
    fr_def = ''
    for entry in entries:
        entry_id = entry.get('id')
        if entry_id and path in entry_id:
            to_wrd = entry.find('td', class_='ToWrd')
            fr_wrd = entry.find('td', class_='FrWrd')
            fr_def = [td for td in entry.find_all('td') if td != to_wrd and td != fr_wrd].pop()
            fr_pos = fr_wrd.find('em')
            alt_term = fr_wrd.find('strong')
            alt_term = alt_term.find(text=True, recursive=False)
            fr_pos = fr_pos.find(text=True, recursive=False)
            fr_def = fr_def.find_all(text=True, recursive=False).pop()
            to_def = to_wrd.find(text=True, recursive=False)
            if alt_term:
                altterms.append(alt_term.strip())
            if to_def:
                definitions.append(to_def.strip())
            if fr_pos:
                pos.append(fr_pos.strip())
        else:
            fr_ex = entry.find('td', class_='FrEx')
            if fr_ex:
                e = fr_ex.find(text=True).split('.').pop(0) + '.'
                if fr_def:
                    e = f'{e[:-1]} {fr_def.strip()}.'
                examples.append(e)
    pronunciations = [p.find(text=True, recursive=False) for p in pron]
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
    entries = get_entries_for_term(args.lfrom, args.lto, 'long')
    print(entries)


if __name__ == '__main__':
    main()
