import ModuleTabs from "./ModuleTabs";
import StockCountLab from "./StockCountLab";
import SuperstockLab from "./SuperstockLab";
import FairPriceLab from "./FairPriceLab";

/**
 * Stock-picking module: the hard truths about owning individual stocks.
 *  • How many is enough? Diversifying within stocks cuts risk, but only to a floor.
 *  • Why a few win: most stocks lose to T-bills; a tiny few create all the wealth.
 *  • What's a fair price? A DCF with the knobs exposed — tiny assumption
 *    changes swing "fair value" violently, so humility beats conviction.
 * Together: owning them all beats trying to pick the winners.
 */
export default function StockPickingModule() {
  return (
    <ModuleTabs
      label="Hard truths about picking stocks"
      tabs={[
        { id: "count", label: "How many is enough?", render: () => <StockCountLab /> },
        { id: "super", label: "Why a few win", render: () => <SuperstockLab /> },
        { id: "price", label: "What's a fair price?", render: () => <FairPriceLab /> },
      ]}
    />
  );
}
