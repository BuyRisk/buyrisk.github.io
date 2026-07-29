/**
 * A small, consistent "Restore defaults" control for the interactive tools, so a
 * user who has wandered deep into the sliders can snap everything back to the
 * starting state. Each tool passes its own reset handler.
 */
export default function ResetButton({ onReset }: { onReset: () => void }) {
  return (
    <button type="button" className="tool-reset" onClick={onReset} aria-label="Restore default settings">
      <span aria-hidden="true">↺</span> Restore defaults
    </button>
  );
}
