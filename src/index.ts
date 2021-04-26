#!/usr/bin/env node
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
    .option("frequency", {
      alias: "freq",
      type: "string",
      description: "Frequency list to translate from",
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
    const pbar = createProgressBar();
    const words = await getFrequencyList(
      argv.from,
      argv.frequency,
    ).then(words => words.slice(0, argv.nwords || words.length));
    const chunks = chunkfy(words, argv.chunkSize);
    const results = [];
    pbar.start(words.length, 0, { speed: "N/A" });
    let start = Date.now();
    for (const chunk of chunks) {
      results.push(
        ...(await Promise.all(chunk.map(word => wr(word, argv.from, argv.to)))),
      );
      updateProgressBar(pbar, results.length, start);
    }
    pbar.stop();
  }
}

main();
