import ModuleTabs from "./ModuleTabs";
import WaveformLab from "./WaveformLab";
import CorrelationSpikeLab from "./CorrelationSpikeLab";
import RandomnessLab from "./RandomnessLab";
import IndexConcentrationLab from "./IndexConcentrationLab";

/**
 * Diversification module: four views of one idea.
 *  • Waves (the pure, idealized picture): out-of-phase ups and downs cancel.
 *  • Shifting correlations (the catch): correlation isn't constant — it spikes
 *    toward +1 in the extremes (rallies and sell-offs alike), so the cancellation
 *    fades exactly when moves are largest.
 *  • Messy reality (real, noisy mean-reverting returns): cancellation is partial
 *    and assets sometimes move together.
 *  • Concentration (the anti-diversification): a cap-weighted "500-stock" index
 *    can be dominated by a handful of giants — a hidden risk.
 */
export default function DiversificationModule() {
  return (
    <ModuleTabs
      label="Four views of the same idea"
      tabs={[
        { id: "waves", label: "Waves: the idea", render: () => <WaveformLab /> },
        { id: "correlation", label: "Shifting correlations", render: () => <CorrelationSpikeLab /> },
        { id: "noise", label: "Messy reality", render: () => <RandomnessLab /> },
        { id: "concentration", label: "How top-heavy is the market?", render: () => <IndexConcentrationLab /> },
      ]}
    />
  );
}
