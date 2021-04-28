# migaku-wr-dict

Generate [Migaku Dictionaries](https://www.migaku.io/tools-guides/migaku-dictionary/quickstart) with [WordReference](https://www.wordreference.com/) definitions using the frequency lists from [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords).

Please, report any issues and I will try to fix them as soon as possible.

## Usage

`npx migaku-wr-dict`

## Examples

- Show help text
  - `npx migaku-wr-dict --help`
- Generate English to Arabic dictionary with all English words (over 1.6 million, not recommended)
  - `npx migaku-wr-dict -f en -t ar`
- Generate English to Arabic dictionary with 100.000 most used English words
  - `npx migaku-wr-dict -f en -t ar -n 100000`
- Generate English to Arabic dictionary with 100.000 most used English words to specific output file
  - `npx migaku-wr-dict -f en -t ar -n 100000 -o /path/to/dict/migaku_wr_dict_enar`
- Generate English to Arabic dictionary with 100.000 most used words and save Word Reference data for future use
  - `npx migaku-wr-dict -f en -t ar -n 100000 -s migaku-wr-data`
- Generate English to Arabic dictionary from saved Word Reference data
  - `npx migaku-wr-dict -f en -t ar -n 100000 -d migaku-wr-data`
- Generate English to Arabic with 100.000 most used words and chunk size of 50 (not recommended)
  - `npx migaku-wr-dict -f en -t ar -n 100000 -c 50`
- Generate English to Arabic from specific word frequency list
  - `npx migaku-wr-dict -f en -t ar -w frequency.txt`
- Generate English to Arabic with 100.000 most used words and append specific word frequency list
  - `npx migaku-wr-dict -f en -t ar -n 100000 -a frequency.txt`
- Get Word Reference JSON data for an specific word "rainbow"
  - `npx migaku-wr-dict -f en -t ar -g rainbow`

## License

```
MIT License

Copyright (c) 2020 Guilherme Caulada (Sighmir)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
