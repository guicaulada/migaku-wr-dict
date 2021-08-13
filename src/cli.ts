import { AxiosError } from "axios";
import { printTable } from "console-table-printer";
import yargs from "yargs";
import {
  generateMigakuDictionary,
  getAvailableLanguages,
  getFrequencyList,
  getValidMonolingual,
  wr,
  zipMigakuDictionary,
} from "./api";
import { Arguments, FrequencyItem, WordReferenceResult } from "./types";
import {
  chunkfy,
  createProgressBar,
  readJSON,
  updateProgressBar,
  writeJSON,
} from "./utils";

export async function getArguments(args?: string[]): Promise<Arguments> {
  const langs = await getAvailableLanguages();
  const langCodes = langs.map((lang) => lang.code);
  const pargs = (args ? yargs(args) : yargs)
    .option("from", {
      alias: "f",
      type: "string",
      description: "Language to translate from",
    })
    .option("to", {
      alias: "t",
      type: "string",
      description: "Language to translate to",
    })
    .option("output", {
      alias: "o",
      type: "string",
      description: "Output file for dictionary",
      default: "migaku_wr_dict",
    })
    .option("chunkSize", {
      alias: "c",
      type: "number",
      description: "Number of words to process concurrently",
      default: 30,
    })
    .option("offset", {
      alias: "e",
      type: "number",
      description: "Offset start of the frequency list",
      default: 0,
    })
    .option("noExamples", {
      alias: "x",
      type: "boolean",
      description: "Remove examples from definition",
    })
    .option("nwords", {
      alias: "n",
      type: "number",
      description: "Number of words to translate from frequency list",
    })
    .option("words", {
      alias: "w",
      type: "string",
      description: "Frequency list to translate from",
    })
    .option("append", {
      alias: "a",
      type: "boolean",
      description: "Append frequency list or data to results",
    })
    .option("get", {
      alias: "g",
      type: "string",
      description: "Get results for a single word",
    })
    .option("data", {
      alias: "d",
      type: "string",
      description: "Input file for WordReference data",
    })
    .option("save", {
      alias: "s",
      type: "string",
      description: "Output file for WordReference data",
    })
    .option("header", {
      alias: "h",
      type: "string",
      description: "Generate Migaku Dictionary header file",
    })
    .option("langs", {
      alias: "l",
      type: "boolean",
      description: "List available languages",
    });
  const argv = pargs.argv;
  if (!argv.langs) {
    pargs.demandOption("from");
    pargs.demandOption("to");
    if (argv.from == argv.to) {
      const monolingual = getValidMonolingual();
      pargs.choices("from", monolingual);
      pargs.choices("to", monolingual);
    } else {
      pargs.choices("from", langCodes);
      pargs.choices("to", langCodes);
    }
  }
  return pargs.argv;
}

export async function getFrequency(argv: Arguments): Promise<FrequencyItem[]> {
  const words = await getFrequencyList(argv.from!, argv.words).then((words) =>
    words.slice(argv.offset, argv.offset + (argv.nwords || words.length)),
  );
  if (argv.append && argv.words) {
    words.push(
      ...(await getFrequencyList(argv.from!, argv.words).then((words) =>
        words.slice(0, argv.nwords || words.length),
      )),
    );
  }
  return words;
}

export async function getResults(
  frequencies: FrequencyItem[],
  argv: Arguments,
  msg = "Collecting data",
): Promise<{ results: WordReferenceResult[]; errors: AxiosError[] }> {
  const pbar = createProgressBar(msg);
  const results = [];
  const chunks = chunkfy(frequencies, argv.chunkSize);
  const errors: AxiosError[] = [];
  pbar.start(frequencies.length, 0, { speed: "N/A" });
  const start = Date.now();
  for (const chunk of chunks) {
    const chunkRecaptcha: FrequencyItem[] = [];
    const chunkErrors: AxiosError[] = [];
    const chunkResults = await Promise.all(
      chunk.map((freq) =>
        wr(freq.word, argv.from!, argv.to!, freq.frequency).catch((err) => {
          if (err.message.includes("reCAPTCHA")) {
            chunkRecaptcha.push(freq);
            return;
          } else {
            chunkErrors.push(err);
            return freq;
          }
        }),
      ),
    );
    errors.push(...chunkErrors);
    results.push(...chunkResults.filter((result) => result));
    updateProgressBar(pbar, results.length, start);
    if (chunkRecaptcha.length) {
      chunks.push(chunkRecaptcha);
    }
  }
  pbar.stop();
  return { results: results as WordReferenceResult[], errors };
}

export function printErrors(errors: AxiosError[]): void {
  if (errors.length > 0) {
    for (const err of errors) {
      try {
        const word = decodeURIComponent(err.config.url!.split("/").pop()!);
        console.log(`Error processing word: ${word} - ${err.message}`);
      } catch {
        console.log(err);
      }
    }
  }
}

export function getOutputFile(path: string, from: string, to: string): string {
  if (path.slice(-1) == "/") path = path + "migaku_wr_dict";
  if (path.slice(-4) != ".zip") path = path + `_${from}${to}`;
  return path;
}

export async function printWordReference(
  word: string,
  from: string,
  to: string,
): Promise<void> {
  console.log(JSON.stringify(await wr(word, from, to)));
}

export function generateFromData(argv: Arguments): void {
  const output = getOutputFile(argv.output, argv.from!, argv.to!);
  const data = readJSON<WordReferenceResult[]>(argv.data!);
  const dict = generateMigakuDictionary(data, argv.header, !argv.noExamples);
  zipMigakuDictionary(output, dict);
}

export async function generateFromResults(argv: Arguments): Promise<void> {
  const freq = await getFrequency(argv);
  const output = getOutputFile(argv.output, argv.from!, argv.to!);
  const { results, errors } = await getResults(freq, argv);
  if (argv.data && argv.append) {
    const data = readJSON<WordReferenceResult[]>(argv.data);
    results.unshift(...data);
  }
  printErrors(errors);
  const dict = generateMigakuDictionary(results, argv.header, !argv.noExamples);
  zipMigakuDictionary(output, dict);
  if (argv.save) {
    writeJSON(argv.save, results);
  }
}

export async function printAvailableLanguages(): Promise<void> {
  const langs = await getAvailableLanguages();
  printTable(langs);
}
