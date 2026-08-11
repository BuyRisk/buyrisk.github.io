import ModuleTabs from "./ModuleTabs";
import WaveformLab from "./WaveformLab";
import RandomnessLab from "./RandomnessLab";
import IndexConcentrationLab from "./IndexConcentrationLab";

/**
 * Diversification module: three views of one idea.
 *  • Waves (the pure, idealized picture): out-of-phase ups and downs cancel.
 *  • Randomness (the messy reality): cancellation is partial and assets
 *    sometimes fall together.
 *  • Concentration (the anti-diversification): a cap-weighted "500-stock" index
 *    can be dominated by a handful of giants — a hidden risk.
 */
export default function DiversificationModule() {
  return (
    <ModuleTabs
      label="Three views of the same idea"
      tabs={[
        { id: "waves", label: "Waves: the idea", render: () => <WaveformLab /> },
        { id: "noise", label: "Randomness: the reality", render: () => <RandomnessLab /> },
        { id: "concentration", label: "How top-heavy is the market?", render: () => <IndexConcentrationLab /> },
      ]}
    />
  );
}
