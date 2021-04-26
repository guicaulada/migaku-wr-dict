#!/usr/bin/env node
import { AxiosResponse } from "axios";
import yargs from "yargs";
import { getFrequencyList, wr } from "./api";
import { Arguments } from "./types";
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
      type: "string",
      description: "Append frequency list to default",
    })
    .option("search", {
      alias: "s",
      type: "string",
      description: "Get results for a single word",
    })
    .option("chunkSize", {
      alias: "c",
      type: "number",
      description: "Number of words to process concurrently",
      default: 10,
    }).argv;
}

export async function main(args?: string[], force = false): Promise<void> {
  if (require.main === module || force) {
    const argv = getArguments(args);
    if (argv.search) {
      console.log(JSON.stringify(await wr(argv.search, argv.from, argv.to)));
      return;
    }
    const pbar = createProgressBar();
    const words = await getFrequencyList(argv.from, argv.words).then((words) =>
      words.slice(0, argv.nwords || words.length),
    );
    if (argv.append) {
      words.push(
        ...(await getFrequencyList(argv.from, argv.words).then((words) =>
          words.slice(0, argv.nwords || words.length),
        )),
      );
    }
    const chunks = chunkfy(words, argv.chunkSize);
    const results = [];
    const errors: AxiosResponse[] = [];
    pbar.start(words.length, 0, { speed: "N/A" });
    let start = Date.now();
    for (const chunk of chunks) {
      results.push(
        ...(await Promise.all(
          chunk.map((word) =>
            wr(word, argv.from, argv.to).catch(({ response }) => {
              errors.push(response as AxiosResponse);
              return { word };
            }),
          ),
        )),
      );
      updateProgressBar(pbar, results.length, start);
    }
    pbar.stop();
    if (errors.length > 0) {
      for (const err of errors) {
        const word = decodeURIComponent(
          err.config.url?.split("/").pop() || "unknown",
        );
        console.log(
          `Error processing word: ${word} - ${err.statusText} (code: ${err.status})`,
        );
      }
    }
  }
}

main();
