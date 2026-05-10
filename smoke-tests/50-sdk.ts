import { startServer } from '../dist/client';
import { assertEq, assertContains, assertEndsWith } from './_helpers';

const main = async (): Promise<void> => {
  const session = await startServer();
  console.log(`server up on :${session.port}`);

  try {
    await session.nav('https://example.com');

    assertEq('url', await session.url(), 'https://example.com/');
    assertEq('title', await session.title(), 'Example Domain');
    assertEq(
      'link count',
      await session.eval<number>('document.querySelectorAll("a").length'),
      1,
    );
    assertContains('snap', await session.snap(), 'Example Domain');
    assertEndsWith('shot path', (await session.shot('sdk-shot')).path, 'sdk-shot.png');

    const cookies = await session.play<number>('return (await context.cookies()).length;');
    console.log(`  cookies: ${cookies}`);

    console.log('OK — SDK');
  } finally {
    await session.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
