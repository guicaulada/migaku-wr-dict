import argparse
import asyncio
import json
import re
from functools import partial
from multiprocessing import Pool

import aiohttp
import pandas as pd
import requests
from bs4 import BeautifulSoup
from tqdm.asyncio import tqdm

URL = 'https://www.wordreference.com'


def parse_args():
    parser = argparse.ArgumentParser(prog='migaku-wr-dict',
                                     description='Generate Migaku Dictionaries with WordReference definitions')
    parser.add_argument('--from', type=str, dest='lfrom', required=True,
                        help='The language you want to translate from')
    parser.add_argument('--to', type=str, dest='lto', required=True,
                        help='The language you want to translate to')
    parser.add_argument('--words', '-w', type=str, dest='words', required=True,
                        help='Path to word list to translate from')
    parser.add_argument('--freq', '-f', type=str, dest='freq',
                        help='Path to frequency list (optional)')
    parser.add_argument('--threads', '-t', type=int, dest='threads', default=10,
                        help='Path to frequency list (optional)')
    parser.add_argument('--nwords', '-n', type=int, dest='nwords',
                        help='Number of words to translate')
    parser.add_argument('--debug', action='store_true', dest='debug',
                        help='Print debug output')
    args = parser.parse_args()
    return args


async def get_entries_for_term(term, lfrom, lto, semaphore):
    async with semaphore:
        path = lfrom + lto
        url = f'{URL}/{path}/{term}'
        altterms = []
        pronunciations = []
        definitions = []
        pos = []
        examples = []
        audios = []
        content = None
        async with aiohttp.request('GET', url) as response:
            content = await response.text()
        soup = BeautifulSoup(content, 'html.parser')
        top = soup.find('div', class_='pwrapper')
        if not top:
            return pd.DataFrame(columns=[
                'term', 'altterms', 'pronunciations', 'definitions', 'pos', 'examples', 'audios',
            ])
        pron = top.find_all('span', class_=['pronWR', 'pronRH'])
        tables = soup.find_all('table', class_='WRD')
        pronunciations = [p.find(text=True, recursive=False) for p in pron]
        last_entry = None
        entry_ex = []
        fr_def = ''
        i = 0
        while tables:
            for table in tables:
                entries = table.find_all('tr', class_=['even', 'odd'])
                for entry in entries:
                    entry_id = entry.get('id')
                    if entry_id and path in entry_id:
                        if last_entry and entry_id != last_entry:
                            examples.append(entry_ex)
                            entry_ex = []
                        to_wrd = entry.find('td', class_='ToWrd')
                        to_def = to_wrd.find(text=True, recursive=False)
                        fr_wrd = entry.find('td', class_='FrWrd')
                        fr_def = [td for td in entry.find_all('td') if td != to_wrd and td != fr_wrd].pop()
                        fr_def = fr_def.find_all(text=True, recursive=False).pop()
                        fr_pos = fr_wrd.find('em')
                        fr_pos = fr_pos.find(text=True, recursive=False)
                        altterm = fr_wrd.find('strong')
                        altterm = altterm.find(text=True, recursive=False)
                        altterms.append(altterm.strip())
                        definitions.append(to_def.strip())
                        if fr_pos:
                            pos.append(fr_pos.strip())
                        last_entry = entry_id
                    else:
                        fr_ex = entry.find('td', class_='FrEx')
                        to_ex = entry.find('td', class_='ToEx')
                        if fr_ex:
                            fr_ex = fr_ex.find(text=True)
                            if fr_def:
                                fr_ex = f'{fr_ex} {fr_def.strip()}'
                            entry_ex.append(fr_ex)
                        if to_ex:
                            to_ex = to_ex.find(text=True)
                            entry_ex.append(to_ex)
            i = i + 100
            result = requests.get(url + f'?start={i}')
            soup = BeautifulSoup(result.content, 'html.parser')
            tables = soup.find_all('table', class_='WRD')
        pronunciations = [pronunciations] * len(altterms)
        pronunciations = [p if altterms[i] == term else None for i, p in enumerate(pronunciations)]
        if altterms:
            examples.append(entry_ex)
        return pd.DataFrame({
            'term': term,
            'altterms': altterms,
            'pronunciations': pronunciations,
            'definitions': definitions,
            'pos': pos,
            'examples': examples,
            'audios': None,
        })


async def main(loop):
    args = parse_args()
    entries = []
    words = []
    jobs = []

    loop.set_debug(args.debug)
    with open(args.words) as f:
        words = f.readlines()
    
    if args.nwords:
        words = words[:args.nwords]

    semaphore = asyncio.Semaphore(args.threads)
    pbar = tqdm(total=len(words))
    for word in words:
        jobs.append(asyncio.ensure_future(get_entries_for_term(word.strip(), args.lfrom, args.lto, semaphore)))
    
    for job in asyncio.as_completed(jobs):
        value = await job
        entries.append(value)
        pbar.update()

    print(pd.concat(entries).reset_index())
    pbar.close()


if __name__ == '__main__':
    loop = asyncio.get_event_loop()
    loop.run_until_complete(main(loop))
