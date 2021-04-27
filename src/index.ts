#!/usr/bin/env node
import { generateMigakuDictionary, wr, zipMigakuDictionary } from "./api";
import { getArguments, getFrequency, getResults, printErrors } from "./cli";
import { WordReferenceResult } from "./types";
import { readJSON, writeJSON } from "./utils";

export async function main(args?: string[], force = false): Promise<void> {
  if (require.main === module || force) {
    const argv = getArguments(args);
    if (argv.get) {
      console.log(JSON.stringify(await wr(argv.get, argv.from, argv.to)));
      return;
    }
    if (argv.data && !argv.append) {
      const data = readJSON<WordReferenceResult[]>(argv.data);
      const dict = generateMigakuDictionary(data);
      zipMigakuDictionary(argv.output, dict);
      return;
    }
    const freq = await getFrequency(argv);
    const { results, errors } = await getResults(freq, argv);
    if (argv.data && argv.append) {
      const data = readJSON<WordReferenceResult[]>(argv.data);
      results.unshift(...data);
    }
    printErrors(errors);
    const dict = generateMigakuDictionary(results);
    zipMigakuDictionary(argv.output, dict);
    if (argv.save) {
      writeJSON(argv.save, results);
    }
  }
}

main();
