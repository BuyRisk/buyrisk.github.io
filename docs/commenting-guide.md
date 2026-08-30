# Commenting guide (plain language)

Rules for comments in this codebase. Written for a curious person, not a
compiler.

## What every file gets
- A short header at the top: what this file does, what data goes in, what
  comes out, and (for data scripts) which source it reads and how to cite it.

## What gets an inline comment
- Any finance math (why this formula, in words).
- Any number that isn't obvious (where 0.04 came from, why 1926).
- Any jargon, defined the first time it appears — same rule as the site copy.
- Anything a reasonable person would ask "why?" about.

## What does NOT get a comment
- Code that plainly says what it does (`total += fee` needs no comment).
- Restating the code in English ("loop over rows").

## House rules
- Comments never change behavior. If a comment reveals a bug, log it —
  don't fix it in a commenting pass.
- A file is only commented after it has been run and its output verified.
- Log every commented file in docs/commenting-log.md, in plain language.
