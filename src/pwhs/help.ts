export const HELP = `Usage: pwhs <verb> [args] [-p <port>]

Lifecycle:
  pwhs up [server-flags]      Start a server, print its port to stdout
  pwhs down [-p <port>]       Stop the server on <port>
  pwhs down --all             Stop every running server
  pwhs ls                     List running servers (pruned to live pids)

Browser:
  pwhs status                 GET /status
  pwhs start [device]         POST /browser/start (optional device name)
  pwhs stop                   POST /browser/stop
  pwhs restart [device]       POST /browser/restart

Navigation:
  pwhs nav <url>              POST /navigate
  pwhs url                    GET /url
  pwhs title                  GET /title
  pwhs html                   GET /content
  pwhs snap [selector]        GET /snapshot

Interaction:
  pwhs click <selector>
  pwhs type <selector> <text>
  pwhs hover <selector>
  pwhs select <selector> <value>
  pwhs scroll [x] [y]
  pwhs key <key>
  pwhs wait <selector> [timeout-ms]

Capture:
  pwhs shot [name]            POST /screenshot, prints filepath
  pwhs shots                  GET /screenshots

Code execution:
  pwhs eval <js>              POST /execute/inline (page context)
  pwhs play <js>              POST /script/execute-playwright (Playwright API)

Activity:
  pwhs poll [since]
  pwhs check [since]

Multi-tab:
  pwhs pages
  pwhs switch <index>
  pwhs latest

Port selection (every verb except up/ls):
  --port <n> / -p <n>     Per-call override.
  $PWHS_PORT              Sticky session for the shell.
  Neither set, multiple servers running -> error showing the options.
  Neither set, no servers running       -> error suggesting 'pwhs up'.
`;
