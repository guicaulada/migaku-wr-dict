# migaku-wr-dict

Generate [Migaku Dictionaries](https://www.migaku.io/tools-guides/migaku-dictionary/quickstart) with [WordReference](https://www.wordreference.com/) definitions.

## Installation

- `pip install migaku-wr-dict`

## Usage

- `migaku-wr-dict --help`

## Install local version

If you have cloned this repository you can run:

```
python3 setup.py install
```

## Build and publish

If you had created this package you would be able to run:

```
python3 setup.py sdist bdist_wheel
twine upload dist/*
```

## License

```
migaku-wr-dict - Generate Migaku Dictionaries with WordReference definitions
Copyright (C) 2021  Guilherme Caulada

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
```
