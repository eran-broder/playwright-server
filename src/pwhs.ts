#!/usr/bin/env node
import { extractPort, resolvePort } from './pwhs/resolve';
import { up, down, ls } from './pwhs/lifecycle';
import { isVerbName, runVerb } from './pwhs/verbs';
import { print } from './pwhs/format';
import { HELP } from './pwhs/help';

const main = async (): Promise<void> => {
  const argv = process.argv.slice(2);
  const { port: flagPort, args: nonFlag } = extractPort(argv);
  const verb = nonFlag[0];
  const args = nonFlag.slice(1);

  if (!verb || verb === '-h' || verb === '--help') {
    process.stdout.write(HELP);
    return;
  }

  if (verb === 'up') return up(args);
  if (verb === 'ls') return ls();
  if (verb === 'down') return down(flagPort, args);

  if (!isVerbName(verb)) {
    throw new Error(`Unknown verb: ${verb}\n\n${HELP}`);
  }

  const port = resolvePort(flagPort);
  const result = await runVerb(verb, port, args);
  print(result);
};

main().catch((err) => {
  process.stderr.write(`${err?.message ?? String(err)}\n`);
  process.exit(1);
});
