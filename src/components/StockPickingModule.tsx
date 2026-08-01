import ModuleTabs from "./ModuleTabs";
import StockCountLab from "./StockCountLab";
import SuperstockLab from "./SuperstockLab";

/**
 * Stock-picking module: the two hard truths about owning individual stocks.
 *  • How many is enough? — diversifying within stocks cuts risk, but only to a floor.
 *  • Why a few win — most stocks lose to T-bills; a tiny few create all the wealth.
 * Together: owning them all beats trying to pick the winners.
 */
export default function StockPickingModule() {
  return (
    <ModuleTabs
      label="Two truths about picking stocks"
      tabs={[
        { id: "count", label: "How many is enough?", render: () => <StockCountLab /> },
        { id: "super", label: "Why a few win", render: () => <SuperstockLab /> },
      ]}
    />
  );
}
