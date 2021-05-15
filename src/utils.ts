import cliProgress from "cli-progress";
import fs from "fs";

export function chunkfy<T>(arr: T[], chunkSize: number): T[][] {
  return arr
    .map((_, i, arr) => arr.slice(i * chunkSize, (i + 1) * chunkSize))
    .slice(0, Math.ceil(arr.length / chunkSize));
}

export function createProgressBar(msg: string): cliProgress.SingleBar {
  return new cliProgress.SingleBar({
    format: `${msg} | {bar} {percentage}% | {duration_formatted}<{eta_formatted} | {value}/{total} | {speed}`,
    barCompleteChar: "\u2588",
    barIncompleteChar: "\u2591",
    hideCursor: false,
  });
}

export function updateProgressBar(
  pbar: cliProgress.SingleBar,
  items: number,
  start: number,
) {
  let elapsed = (Date.now() - start) / 1000;
  let speed = items / elapsed;
  pbar.update(items, {
    speed: `${speed.toFixed(2)}it/s`,
  });
}

export function writeJSON(path: string, data: any) {
  if (path.slice(-1) == "/") path = path.slice(0, -1);
  if (path.slice(-5) != ".json") {
    path = path + ".json";
  }
  return fs.writeFileSync(path, JSON.stringify(data), "utf-8");
}

export function readJSON<T>(path: string): T {
  return JSON.parse(fs.readFileSync(path, "utf-8"));
}

export function expand<T>(arr: T[][]): T[] {
  return arr.reduce((a, b) => {
    a.push(...b);
    return a;
  }, []);
}

export function removeLeadingRegex(rgx: RegExp, str: string) {
  const arr = str.split("");
  while (arr.length && rgx.test(arr[0])) {
    arr.shift();
  }
  return arr.join("").trim();
}

export function removeTrailingRegex(rgx: RegExp, str: string) {
  const arr = str.split("");
  while (arr.length && rgx.test(arr.slice(-1).pop()!)) {
    arr.pop();
  }
  return arr.join("").trim();
}

export function trimRegex(rgx: RegExp, str: string): string {
  str = removeLeadingRegex(rgx, str);
  str = removeTrailingRegex(rgx, str);
  return str;
}
