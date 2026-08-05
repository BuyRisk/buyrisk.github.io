import ModuleTabs from "./ModuleTabs";
import EmhLab from "./EmhLab";
import MarketTimingLab from "./MarketTimingLab";
import DcaLab from "./DcaLab";
import SpivaLab from "./SpivaLab";
import ClosetIndexingLab from "./ClosetIndexingLab";

/**
 * "Can You Outsmart the Market?" module: five angles on the same answer: no.
 *  • Predict it: the efficient-markets coin-flip game.
 *  • Time it: the cost of missing the best days / the worst market timer.
 *  • When to deploy: lump sum vs. dollar-cost averaging a windfall.
 *  • Beat it: the SPIVA evidence on active managers.
 *  • Pay for it: closet indexing — active fees for near-index holdings.
 */
export default function MarketEfficiencyModule() {
  return (
    <ModuleTabs
      label="Five ways people try (and fail) to beat the market"
      tabs={[
        { id: "predict", label: "Predict the next move", render: () => <EmhLab /> },
        { id: "time", label: "Time the market", render: () => <MarketTimingLab /> },
        { id: "deploy", label: "Lump sum vs. averaging", render: () => <DcaLab /> },
        { id: "beat", label: "Beat it with active funds", render: () => <SpivaLab /> },
        { id: "closet", label: "Closet indexing", render: () => <ClosetIndexingLab /> },
      ]}
    />
  );
}
