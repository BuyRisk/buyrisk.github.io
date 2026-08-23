import ModuleTabs from "./ModuleTabs";
import StockCountLab from "./StockCountLab";

/**
 * Stock-picking module: the hard truths about owning individual stocks.
 *  • How many is enough? Diversifying within stocks cuts risk, but only to a floor.
 *  • Why a few win: most stocks lose to T-bills; a tiny few create all the wealth.
 *  • What's a fair price? A DCF with the knobs exposed — tiny assumption
 *    changes swing "fair value" violently, so humility beats conviction.
 *  • Options: the speculation end of the spectrum, and the house's edge.
 * Together: owning them all beats trying to pick the winners.
 * Non-default tabs are code-split (fetched on first open).
 */
export default function StockPickingModule() {
  return (
    <ModuleTabs
      label="Hard truths about picking stocks"
      tabs={[
        { id: "count", label: "How many is enough?", render: () => <StockCountLab /> },
        { id: "super", label: "Why a few win", load: () => import("./SuperstockLab") },
        { id: "price", label: "What's a fair price?", load: () => import("./FairPriceLab") },
        { id: "options", label: "Options: the house edge", load: () => import("./OptionsLab") },
      ]}
    />
  );
}
