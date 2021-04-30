#!/usr/bin/env node
import {
  generateFromData,
  generateFromResults,
  getArguments,
  printAvailableLanguages,
  printWordReference,
} from "./cli";

export async function main(args?: string[], force = false): Promise<void> {
  if (require.main === module || force) {
    const argv = await getArguments(args);
    if (argv.langs) {
      printAvailableLanguages();
      return;
    }
    if (argv.from && argv.to) {
      if (argv.get) {
        printWordReference(argv.get, argv.from, argv.to);
        return;
      }
      if (argv.data && !argv.append) {
        generateFromData(argv);
        return;
      }
      generateFromResults(argv);
    }
  }
}

main();
