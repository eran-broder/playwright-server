export const print = (v: unknown): void => {
  if (v == null) return;
  if (typeof v === 'string') {
    process.stdout.write(v.endsWith('\n') ? v : `${v}\n`);
    return;
  }
  if (typeof v === 'number' || typeof v === 'boolean') {
    process.stdout.write(`${v}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(v, null, 2)}\n`);
};
