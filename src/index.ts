#!/usr/bin/env node
import {
  generateFromData,
  generateFromResults,
  getArguments,
  printWordReference,
} from "./cli";

export async function main(args?: string[], force = false): Promise<void> {
  if (require.main === module || force) {
    const argv = getArguments(args);
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

main();
