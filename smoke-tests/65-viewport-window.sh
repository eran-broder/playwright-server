#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/_helpers.sh"

start_session --viewport window
echo "server up on :$PORT (viewport=window)"

URL=$(node -e "console.log(require('url').pathToFileURL(process.argv[1]).href)" "$HELPERS_DIR/responsive.html")
$PWHS nav "$URL" >/dev/null

resize_and_read() {
  $PWHS play "
    const cdp = await context.newCDPSession(page);
    const { windowId } = await cdp.send('Browser.getWindowForTarget');
    await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
    await cdp.send('Browser.setWindowBounds', { windowId, bounds: { width: $1, height: $2 } });
    await page.waitForFunction((w) => Math.abs(window.outerWidth - w) < 40, $1, { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(300);
    return await page.evaluate(() =>
      getComputedStyle(document.getElementById('breakpoint'), '::after').content +
      ' cols=' + getComputedStyle(document.querySelector('.grid')).gridTemplateColumns.split(' ').length +
      ' resizes=' + document.getElementById('resizes').textContent
    );
  "
}

section "viewport=window: page follows the OS window"
assert_contains "wide window -> desktop breakpoint"   'desktop' resize_and_read 1100 800
assert_contains "wide window -> 3 grid columns"       'cols=3'  resize_and_read 1100 800
assert_contains "medium window -> tablet breakpoint"  'tablet'  resize_and_read 820 700
assert_contains "narrow window -> mobile breakpoint"  'mobile'  resize_and_read 560 700
assert_contains "narrow window -> 1 grid column"      'cols=1'  resize_and_read 560 700

section "resize events reach the page"
RESIZES=$($PWHS eval "document.getElementById('resizes').textContent")
if [ "$RESIZES" != "0" ]; then
  echo "  pass: resize events fired ($RESIZES)"
  assert_pass=$((assert_pass + 1))
else
  echo "  FAIL: no resize events fired"
  assert_fail=$((assert_fail + 1))
fi

section "viewport=emulated: window size is ignored"
$PWHS restart viewport=emulated >/dev/null
$PWHS nav "$URL" >/dev/null
assert_contains "emulated pins innerWidth to 1280" '1280x720' $PWHS eval "innerWidth + 'x' + innerHeight"
resize_and_read 560 700 >/dev/null
assert_contains "emulated stays desktop after window shrink" 'desktop' $PWHS eval "getComputedStyle(document.getElementById('breakpoint'), '::after').content"

section "device + viewport=window is rejected"
assert_fails_with "mutually exclusive" 'mutually exclusive' $PWHS restart "iPhone 14" viewport=window

print_summary_and_exit
