import argparse
import asyncio
import gc
import json
import os
import random
import re
import sys
import time
from functools import partial
from multiprocessing import Pool

import aiohttp
import pandas as pd
import requests
from bs4 import BeautifulSoup
from tqdm.asyncio import tqdm

URL = 'https://www.wordreference.com'
ENTRIES = []
JOBS = []
SAVE = None
PBAR = None
INTERRUPTED = False


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
                        help='Path to frequency list')
    parser.add_argument('--threads', '-t', type=int, dest='threads', default=100,
                        help='Number of threads to execute concurrently')
    parser.add_argument('--offset', '-o', type=int, dest='offset', default=0,
                        help='Offset to start from on words list')
    parser.add_argument('--nwords', '-n', type=int, dest='nwords',
                        help='Number of words to translate')
    parser.add_argument('--proxies', '-p', type=str, dest='proxies',
                        help='Path to rotating proxy list')
    parser.add_argument('--save', '-s', type=str, dest='save', default='migaku-wr-dict.save',
                        help='Path to savefile where data will be stored')
    parser.add_argument('--interval', '-i', type=str, dest='interval', default=5,
                        help='Interval between retries')
    parser.add_argument('--debug', action='store_true', dest='debug',
                        help='Print debug output')
    args = parser.parse_args()
    return args


def empty_entries(term):
    return pd.DataFrame({
        'term': [term],
        'altterms': None,
        'pronunciations': None,
        'definitions': None,
        'pos': None,
        'examples': None,
        'audios': None,
    })


async def get_entries_for_term(term, lfrom, lto, semaphore, proxies=[]):
    async with semaphore:
        path = lfrom + lto
        url = f'{URL}/{path}/{term}'
        altterms = []
        pronunciations = []
        definitions = []
        pos = []
        examples = []
        audios = []
        pron = []
        content = None
        kwargs = {}
        if proxies:
            kwargs.update({'proxy': random.choice(proxies)})
        async with aiohttp.request('GET', url, **kwargs) as response:
            content = await response.text()
        soup = BeautifulSoup(content, 'html.parser')
        top = soup.find('div', class_='pwrapper')
        if top:
            pron = top.find_all('span', class_=['pronWR', 'pronRH'])
            tooltips = [span.find(text=True) for p in pron for span in p.find_all('span')]
            pronunciations = [''.join([t for t in p.find_all(text=True) if t not in tooltips]) for p in pron]
        tables = soup.find_all('table', class_='WRD')
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
                        altterm = altterm.find(text=True)
                        altterms.append(altterm.strip() if altterm else altterm)
                        definitions.append(to_def.strip() if to_def else to_def)
                        pos.append(fr_pos.strip() if fr_pos else fr_pos)
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
            if proxies:
                kwargs.update({'proxy': random.choice(proxies)})
            async with aiohttp.request('GET', url + f'?start={i}', **kwargs) as response:
                content = await response.text()
            soup = BeautifulSoup(content, 'html.parser')
            tables = soup.find_all('table', class_='WRD')
        pronunciations = [pronunciations] * len(altterms)
        if altterms:
            examples.append(entry_ex)
        try:
            df = pd.DataFrame({
                'term': term,
                'altterm': altterms,
                'pronunciations': pronunciations,
                'definition': definitions,
                'pos': pos,
                'examples': examples,
                'audios': None,
            })
            return df if not df.empty else empty_entries(term)
        except Exception as err:
            print(err)
            print(
                'Failed:',
                term,
                len(altterms),
                len(pronunciations),
                len(definitions),
                len(pos),
                len(examples)
            )
            return empty_entries(term)


async def collect_words(words, **kwargs):
    global INTERRUPTED
    global ENTRIES
    global JOBS
    global PBAR
    proxies = []
    error = False
    JOBS = []
    ENTRIES = []
    PBAR = tqdm(total=len(words))
    semaphore = asyncio.Semaphore(kwargs['threads'])

    if kwargs['offset']:
        words = words[kwargs['offset']:]

    if kwargs['nwords']:
        words = words[:kwargs['nwords']]

    if kwargs['proxies']:
        with open(kwargs['proxies']) as f:
            proxies = [l.strip() for l in f.readlines()]

    for word in words:
        JOBS.append(asyncio.ensure_future(get_entries_for_term(word.strip(), kwargs['lfrom'], kwargs['lto'], semaphore, proxies)))

    try:
        for job in asyncio.as_completed(JOBS):
            value = await job
            if not INTERRUPTED:
                ENTRIES.append(value)
                PBAR.update()
    except Exception as err:
        print(err)
        for job in JOBS:
            job.cancel()
        error = True

    PBAR.close()
    return ENTRIES, error


def save_data(df, file):
    global SAVE
    if isinstance(df, list):
        if SAVE is not None:
            df = [SAVE] + df
        df = pd.concat(df).reset_index(drop=True)
    SAVE = df
    df.to_parquet(file)


async def main(**kwargs):
    global SAVE
    error = None
    collection_args = ['threads', 'offset', 'nwords', 'proxies', 'lfrom', 'lto']
    collection_args = {key: kwargs[key] for key in kwargs if key in collection_args}
    while error is None or error:
        words = []
        save = []
        if error:
            print('Retrying now...')

        with open(kwargs['words']) as f:
            print('Reading words list...')
            words = f.readlines()
        
        if os.path.exists(kwargs['save']):
            if SAVE is None:
                print('Reading saved data...')
                SAVE = pd.read_parquet(kwargs['save'])
            print('Filtering words list...')
            saved_words = list(SAVE.term.unique())
            words = [w for w in words if w.strip() not in saved_words]
        gc.collect()

        if words:
            print('Collecting data...')
            entries, error = await collect_words(words, **collection_args)
            if error:
                print('An error was found, retrying in a few seconds...')
            print('Saving collected data...')
            save_data(entries, kwargs['save'])


def exit_process():
    print('\nInterrupting...')
    INTERRUPTED = True
    if PBAR:
        PBAR.close()
    for job in JOBS:
        job.cancel()
    if ENTRIES:
        print('Saving collected data before exit...')
        save_data(ENTRIES, args.save)
    try:
        sys.exit(0)
    except:
        os._exit(0)


if __name__ == '__main__':
    args = parse_args()
    try:
        loop = asyncio.get_event_loop()
        loop.set_debug(args.debug)
        loop.run_until_complete(main(**vars(args)))
    except Exception as err:
        print(err)
        exit_process()
