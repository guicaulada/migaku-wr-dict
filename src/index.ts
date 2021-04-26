#!/usr/bin/env node
import yargs from "yargs";
import { getFrequencyList, wr } from "./api";
import { Arguments } from "./types";

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
    }).argv;
}

export async function main(args?: string[], force = false): Promise<void> {
  if (require.main === module || force) {
    const argv = getArguments(args);
    const words = await getFrequencyList(argv.from, argv.frequency);
    for (const word of words.slice(0, argv.nwords || words.length)) {
      const tr = await wr(word, argv.from, argv.to);
      console.log(tr);
    }
  }
}

main();
