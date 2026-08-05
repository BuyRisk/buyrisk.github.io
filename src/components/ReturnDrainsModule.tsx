import ModuleTabs from "./ModuleTabs";
import FeesLab from "./FeesLab";
import InflationLab from "./InflationLab";
import TaxDragLab from "./TaxDragLab";
import AssetLocationLab from "./AssetLocationLab";

/**
 * "What Eats Your Returns" module: the drains that quietly erode wealth.
 *  • Fees, the drag you control: a small expense ratio compounds against you.
 *  • Inflation, the invisible tax: the buying power a dollar loses over time.
 *  • The tax drag: tax paid along the way never compounds again.
 *  • Asset location: which account holds what, for a free after-tax win.
 * (The last two are US-focused — see the page's region note.)
 */
export default function ReturnDrainsModule() {
  return (
    <ModuleTabs
      label="What quietly eats your returns"
      tabs={[
        { id: "fees", label: "Fees: the drag you control", render: () => <FeesLab /> },
        { id: "inflation", label: "Inflation: the invisible tax", render: () => <InflationLab /> },
        { id: "tax-drag", label: "The tax drag", render: () => <TaxDragLab /> },
        { id: "asset-location", label: "Asset location", render: () => <AssetLocationLab /> },
      ]}
    />
  );
}
