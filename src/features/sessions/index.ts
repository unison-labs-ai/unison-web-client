// The sessions feature's public surface. Other features compose the session
// view through this export (e.g. automation run detail embeds the run's
// session per screens.md §5) — never by importing the feature's internals.
export { SessionView } from "./session-view";
