export const assertEq = <T>(label: string, actual: T, expected: T): void => {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
  }
  console.log(`  ${label}: ${String(actual)}`);
};

export const assertContains = (label: string, haystack: string, needle: string): void => {
  if (!haystack.includes(needle)) {
    throw new Error(
      `${label}: expected to contain "${needle}", got: ${haystack.slice(0, 200)}`,
    );
  }
  console.log(`  ${label}: contains "${needle}"`);
};

export const assertEndsWith = (label: string, value: string, suffix: string): void => {
  if (!value.endsWith(suffix)) {
    throw new Error(`${label}: expected to end with "${suffix}", got: ${value}`);
  }
  console.log(`  ${label}: ends with "${suffix}"`);
};

interface ProcessInfo {
  type: string;
  id: number;
}

export const browserPid = async (ctx: import('playwright').BrowserContext): Promise<number | ''> => {
  const browser = ctx.browser();
  if (!browser) return '';
  const session = await browser.newBrowserCDPSession();
  const { processInfo } = (await session.send('SystemInfo.getProcessInfo')) as { processInfo: ProcessInfo[] };
  await session.detach();
  return processInfo.find((p) => p.type === 'browser')?.id ?? '';
};
