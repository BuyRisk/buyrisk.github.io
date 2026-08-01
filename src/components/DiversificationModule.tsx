import ModuleTabs from "./ModuleTabs";
import WaveformLab from "./WaveformLab";
import RandomnessLab from "./RandomnessLab";

/**
 * Diversification module: two views of one idea.
 *  • Waves — the pure, idealized picture: out-of-phase ups and downs cancel.
 *  • Randomness — the messy reality: cancellation is partial and assets
 *    sometimes fall together.
 */
export default function DiversificationModule() {
  return (
    <ModuleTabs
      label="Two views of the same idea"
      tabs={[
        { id: "waves", label: "Waves — the idea", render: () => <WaveformLab /> },
        { id: "noise", label: "Randomness — the reality", render: () => <RandomnessLab /> },
      ]}
    />
  );
}
