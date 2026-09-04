import { Relay } from '../relay/relay';
import { loadOrCreateToken } from '../relay/token';
import { openUrl } from './open-url';

const PAIR_TIMEOUT_MS = 300_000;
const LABEL_FLAG = '--label';
const NO_OPEN_FLAG = '--no-open';

const flagAfter = (args: string[], flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
};

export const pair = async (args: string[]): Promise<void> => {
  const label = flagAfter(args, LABEL_FLAG) ?? '';
  const relay = new Relay(loadOrCreateToken());
  await relay.listen();
  const url = relay.pairingUrl(label);

  process.stderr.write(`Open this in every browser profile you want to pair:\n  ${url}\n`);
  if (!args.includes(NO_OPEN_FLAG)) {
    openUrl(url);
    process.stderr.write('Opened it in your default browser. Waiting for the extension…\n');
  }

  try {
    const instance = await relay.instances.waitFor(label || undefined, PAIR_TIMEOUT_MS);
    const { brand, version } = instance.instance;
    process.stdout.write(`Paired "${instance.label}" (${brand} ${version})\n`);
  } finally {
    relay.close();
  }
};
