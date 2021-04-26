import cliProgress from "cli-progress";

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
