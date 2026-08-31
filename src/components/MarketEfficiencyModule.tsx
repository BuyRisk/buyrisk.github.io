import ModuleTabs from "./ModuleTabs";
import EmhLab from "./EmhLab";

/**
 * "Can You Outsmart the Market?" module: six angles on the same answer: no.
 *  • Predict it: the efficient-markets coin-flip game.
 *  • Time it: the cost of missing the best days / the worst market timer.
 *  • When to deploy: lump sum vs. dollar-cost averaging a windfall.
 *  • Beat it: the SPIVA evidence on active managers.
 *  • Pay for it: closet indexing — active fees for near-index holdings.
 *  • Watch the money: the industry's own SEC-filed cash register (N-SAR) —
 *    dozens of gross dollars churned per net dollar, and 2016's turn to
 *    outflows.
 * Non-default tabs are code-split (fetched on first open).
 */
export default function MarketEfficiencyModule() {
  return (
    <ModuleTabs
      label="Six ways to see the same answer"
      tabs={[
        { id: "predict", label: "Predict the next move", render: () => <EmhLab /> },
        { id: "time", label: "Time the market", load: () => import("./MarketTimingLab") },
        { id: "deploy", label: "Lump sum vs. averaging", load: () => import("./DcaLab") },
        { id: "beat", label: "Beat it with active funds", load: () => import("./SpivaLab") },
        { id: "closet", label: "Closet indexing", load: () => import("./ClosetIndexingLab") },
        { id: "flows", label: "Watch the money", load: () => import("./FundFlowsLab") },
      ]}
    />
  );
}
