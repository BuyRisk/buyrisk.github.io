/**
 * Small "ⓘ" info affordance for form inputs. Shows a short explanation on hover
 * or keyboard focus. Styling lives in global.css (.infotip*) so it works inside
 * every React island. Use next to an input's label:
 *   <span>Beta <InfoTip text="How much the asset moves with the market." /></span>
 */
export default function InfoTip({ text }: { text: string }) {
  return (
    <span className="infotip" tabIndex={0} role="note" aria-label={text}>
      <span className="infotip-icon" aria-hidden="true">i</span>
      <span className="infotip-bubble" role="tooltip">
        {text}
      </span>
    </span>
  );
}
