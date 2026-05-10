import { startServer } from '../dist/client';

const assertEq = <T>(label: string, actual: T, expected: T): void => {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
  }
  console.log(`  ${label}: ${String(actual)}`);
};

const main = async (): Promise<void> => {
  const session = await startServer();
  console.log(`server up on :${session.port}`);

  try {
    await session.nav('https://example.com');

    const url: string = await session.url();
    assertEq('url ends with example.com/', url, 'https://example.com/');

    const title: string = await session.title();
    assertEq('title', title, 'Example Domain');

    const links: number = await session.eval<number>('document.querySelectorAll("a").length');
    assertEq('link count', links, 1);

    const snap: string = await session.snap();
    if (!snap.includes('Example Domain')) throw new Error('snapshot missing heading');
    console.log(`  snap.length: ${snap.length}`);

    const shot = await session.shot('sdk-shot');
    if (!shot.path.endsWith('sdk-shot.png')) throw new Error(`unexpected shot path: ${shot.path}`);
    console.log(`  screenshot: ${shot.path}`);

    const cookieCount: number = await session.play<number>(
      'return (await context.cookies()).length;',
    );
    console.log(`  cookies: ${cookieCount}`);

    console.log('OK — SDK smoke test passed.');
  } finally {
    await session.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
