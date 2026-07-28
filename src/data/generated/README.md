# Generated data (build output)

Files here are **produced by the reducers in [`/scripts`](../../../scripts)** from
the raw sources in [`data/sources/`](../../../data/sources), not written by hand.
They are small, typed `.ts` modules that the interactive tools import — and,
unlike the raw multi-MB source files, they are the only dataset code that ships
to the browser.

Do not edit these by hand: re-run the matching reducer instead (e.g. a future
`npm run data:build`). Each generated file should carry a header comment naming
the source file and the reducer that produced it, so its provenance is traceable
back to the primary source.

Nothing has been generated yet — reducers get written when we build the tools
that consume them.
