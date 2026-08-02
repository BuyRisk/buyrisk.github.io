import ModuleTabs from "./ModuleTabs";
import EmhLab from "./EmhLab";
import MarketTimingLab from "./MarketTimingLab";
import DcaLab from "./DcaLab";
import SpivaLab from "./SpivaLab";

/**
 * "Can You Outsmart the Market?" module: four angles on the same answer: no.
 *  • Predict it: the efficient-markets coin-flip game.
 *  • Time it: the cost of missing the best days / the worst market timer.
 *  • When to deploy: lump sum vs. dollar-cost averaging a windfall.
 *  • Beat it: the SPIVA evidence on active managers.
 */
export default function MarketEfficiencyModule() {
  return (
    <ModuleTabs
      label="Four ways people try (and fail) to beat the market"
      tabs={[
        { id: "predict", label: "Predict the next move", render: () => <EmhLab /> },
        { id: "time", label: "Time the market", render: () => <MarketTimingLab /> },
        { id: "deploy", label: "Lump sum vs. averaging", render: () => <DcaLab /> },
        { id: "beat", label: "Beat it with active funds", render: () => <SpivaLab /> },
      ]}
    />
  );
}
