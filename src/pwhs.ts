#!/usr/bin/env node
import { extractPort, resolvePort } from './pwhs/resolve';
import { LifecycleVerb, up, down, ls } from './pwhs/lifecycle';
import { keys } from './pwhs/keys';
import { isVerbName, runVerb } from './pwhs/verbs';
import { print } from './pwhs/format';
import { HELP } from './pwhs/help';

const HELP_FLAGS = new Set(['-h', '--help']);

const main = async (): Promise<void> => {
  const argv = process.argv.slice(2);
  const { port: flagPort, args: nonFlag } = extractPort(argv);
  const verb = nonFlag[0];
  const args = nonFlag.slice(1);

  if (!verb || HELP_FLAGS.has(verb)) {
    process.stdout.write(HELP);
    return;
  }

  if (verb === LifecycleVerb.Up) return up(args);
  if (verb === LifecycleVerb.Ls) return ls();
  if (verb === LifecycleVerb.Keys) return keys(args);
  if (verb === LifecycleVerb.Down) return down(flagPort, args);

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
