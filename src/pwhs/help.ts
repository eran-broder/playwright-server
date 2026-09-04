export const HELP = `Usage: pwhs <verb> [args] [-p <port>]

Lifecycle:
  pwhs up [server-flags]      Start a server, print its port to stdout
                              e.g. pwhs up --extension --profile Work
  pwhs down [-p <port>]       Stop the server on <port>
  pwhs down --all             Stop every running server
  pwhs ls                     List running servers (pruned to live pids)
  pwhs token                  Print the pairing token for the browser extension

Browser:
  pwhs status                 GET /status
  pwhs start [device] [viewport=emulated|window] [profile=L] [window=N] [tab=N]
                              POST /browser/start (restarts with merged options).
                              viewport=window makes the page follow the OS window.
                              profile/window/tab pick the extension-mode target.
  pwhs stop                   POST /browser/stop
  pwhs restart [same args]    POST /browser/restart
  pwhs profiles               GET /profiles (extension mode: paired profiles,
                              their windows and tabs)

Navigation (waitUntil: load|domcontentloaded|networkidle|commit):
  pwhs nav <url> [waitUntil]  POST /navigate
  pwhs back [waitUntil]       POST /back
  pwhs forward [waitUntil]    POST /forward
  pwhs reload [waitUntil]     POST /reload
  pwhs url                    GET /url
  pwhs title                  GET /title
  pwhs html                   GET /content
  pwhs snap [selector] [--ai] [--boxes] [--depth=N]
                              GET /snapshot. --ai adds [ref=eN] element refs;
                              act on them: pwhs click "aria-ref=eN"

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
  pwhs cdp <method> [json]    POST /cdp (raw CDP, e.g. pwhs cdp Browser.getVersion)

Tracing & clock:
  pwhs trace start            POST /trace/start
  pwhs trace stop             POST /trace/stop, returns trace.zip path
  pwhs clock set <time>       POST /clock/set (fixed Date.now)
  pwhs clock install [time]   POST /clock/install
  pwhs clock ff <ticks>       POST /clock/fast-forward

Activity:
  pwhs poll [since]
  pwhs check [since]

Multi-tab:
  pwhs pages                  GET /pages (extension mode: every tab, with ids)
  pwhs switch <index>
  pwhs latest

Port selection (every verb except up/ls/token):
  --port <n> / -p <n>     Per-call override.
  $PWHS_PORT              Sticky session for the shell.
  Caller cwd              Server launched from your cwd (or an ancestor of it);
                          nearest launch dir wins. See LAUNCHED-FROM in 'pwhs ls'.
  No match, servers running   -> error showing the options.
  No match, no servers        -> error suggesting 'pwhs up'.
`;
