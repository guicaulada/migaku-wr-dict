from setuptools import setup

with open('requirements.txt') as f:
    requirements = f.readlines()

with open('README.md') as f:
    long_description = f.read()

setup(
    name='migaku-wr-dict',
    version='1.0.0',
    author='Guilherme Caulada',
    author_email='guilherme.caulada@gmail.com',
    url='https://github.com/Sighmir/migaku-wr-dict',
    description='Generate Migaku Dictionaries with WordReference definitions',
    long_description=long_description,
    long_description_content_type="text/markdown",
    license='AGPL-3.0',
    package_dir={'': 'src'},
    py_modules=['migaku-wr-dict'],
    entry_points={
        'console_scripts': [
            'migaku-wr-dict = migaku-wr-dict:main'
        ]
    },
    classifiers=(
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: GNU Affero General Public License v3",
        "Operating System :: OS Independent",
    ),
    keywords='translate migaku dictionary wordreference',
    install_requires=requirements,
    zip_safe=False
)
