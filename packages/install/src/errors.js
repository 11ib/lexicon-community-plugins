// An error whose message is meant for the user, not a stack trace. Anything
// else that escapes main() is a bug and gets printed with its stack.
export class CliError extends Error {
  constructor(message, hint) {
    super(message)
    this.name = 'CliError'
    this.hint = hint ?? null
  }
}
