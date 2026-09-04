const LINES = `API Endpoints:
  GET  /status                    - Server status

Browser:
  POST /browser/start             - (Re)start browser {device?, viewport?, profile?, window?, tab?}
  POST /browser/stop              - Stop browser (extension mode: detach, browser stays open)
  POST /browser/restart           - Restart browser with merged options
  GET  /profiles                  - Extension mode: connected profiles with windows and tabs

Navigation:
  POST /navigate                  - Navigate to URL {url, waitUntil?}
  POST /back                      - History back {waitUntil?}
  POST /forward                   - History forward {waitUntil?}
  POST /reload                    - Reload page {waitUntil?}

Screenshots:
  POST /screenshot                - Take screenshot {name?, fullPage?}
  GET  /screenshot/:name          - Get screenshot image
  GET  /screenshots               - List screenshots

Code Execution:
  POST /execute/inline            - Execute JS on page {code}
  POST /script/save               - Save script {name, code}
  POST /script/execute            - Run saved script {name}
  POST /script/execute-playwright - Execute Playwright code {code}

Page Interaction:
  POST /click                     - Click element {selector}
  POST /type                      - Type text {selector, text}
  POST /wait                      - Wait for selector {selector, timeout?}
  GET  /content                   - Get page HTML
  GET  /snapshot                  - Accessibility tree (YAML) {selector?, refs?, boxes?, depth?}
                                    refs=true adds [ref=eN]; act on them via selector "aria-ref=eN"
  GET  /title                     - Get page title
  GET  /url                       - Get current URL
  POST /keyboard                  - Press key {key}
  POST /select                    - Select option {selector, value}
  POST /hover                     - Hover element {selector}
  POST /scroll                    - Scroll page {x?, y?}

CDP / Tracing / Clock:
  POST /cdp                       - Raw CDP command {method, params?}
  POST /trace/start               - Start Playwright tracing {screenshots?, snapshots?}
  POST /trace/stop                - Stop tracing, returns trace.zip path
  POST /clock/install             - Install controllable clock {time?}
  POST /clock/set                 - Set fixed time {time}
  POST /clock/fast-forward        - Jump clock forward {ticks}

Pages / Tabs:
  GET  /pages                     - List pages (extension mode: every tab in the profile)
  POST /pages/switch              - Switch by index {index}
  POST /pages/switch-latest       - Switch to the newest page

Activity Recording (auto-starts, captures network + console + errors + ws + downloads):
  GET  /activity/poll?since=N     - Poll new events since watermark N (KEY ENDPOINT)
  GET  /activity/check?since=N    - Quick check if anything happened
  GET  /activity/log              - Get activity log (filters: since, types, limit)
  GET  /activity/summary          - Get activity summary
  GET  /activity/status           - Recording state
  POST /activity/start            - Start recording {captureNetworkBodies?}
  POST /activity/stop             - Stop recording
  POST /activity/config           - Configure {autoStart?}
  DEL  /activity/log              - Clear log
`;

export const printEndpoints = (): void => {
  console.log(LINES);
};
