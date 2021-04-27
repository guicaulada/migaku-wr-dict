import { AxiosError } from "axios";
import yargs from "yargs";
import { getFrequencyList, wr } from "./api";
import { Arguments, FrequencyItem, WordReferenceResult } from "./types";
import { chunkfy, createProgressBar, updateProgressBar } from "./utils";

export function getArguments(args?: string[]): Arguments {
  return (args ? yargs(args) : yargs)
    .option("from", {
      alias: "f",
      type: "string",
      description: "Language to translate from",
      required: true,
    })
    .option("to", {
      alias: "t",
      type: "string",
      description: "Language to translate to",
      required: true,
    })
    .option("output", {
      alias: "o",
      type: "string",
      description: "Output file for dictionary",
      default: "migaku-wr-dict",
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
    }).argv;
}

export async function getFrequency(argv: Arguments): Promise<FrequencyItem[]> {
  const words = await getFrequencyList(argv.from, argv.words).then((words) =>
    words.slice(argv.offset, argv.offset + (argv.nwords || words.length)),
  );
  if (argv.append && argv.words) {
    words.push(
      ...(await getFrequencyList(argv.from, argv.words).then((words) =>
        words.slice(0, argv.nwords || words.length),
      )),
    );
  }
  return words;
}

export async function getResults(
  frequencies: FrequencyItem[],
  argv: Arguments,
): Promise<{ results: WordReferenceResult[]; errors: AxiosError[] }> {
  const pbar = createProgressBar("Collecting data");
  const results = [];
  const chunks = chunkfy(frequencies, argv.chunkSize);
  const errors: AxiosError[] = [];
  pbar.start(frequencies.length, 0, { speed: "N/A" });
  let start = Date.now();
  for (const chunk of chunks) {
    results.push(
      ...(await Promise.all(
        chunk.map((freq) =>
          wr(freq.word, argv.from, argv.to, freq.frequency).catch((err) => {
            errors.push(err);
            return freq as WordReferenceResult;
          }),
        ),
      )),
    );
    updateProgressBar(pbar, results.length, start);
  }
  pbar.stop();
  return { results, errors };
}

export function printErrors(errors: AxiosError[]) {
  if (errors.length > 0) {
    for (const err of errors) {
      try {
        const word = decodeURIComponent(err.config.url?.split("/").pop()!);
        console.log(`Error processing word: ${word} - ${err.message}`);
      } catch {
        console.log(err);
      }
    }
  }
}
