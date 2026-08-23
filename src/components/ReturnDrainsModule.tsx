import ModuleTabs from "./ModuleTabs";
import FeesLab from "./FeesLab";

/**
 * "What Eats Your Returns" module: the drains that quietly erode wealth.
 *  • Fees, the drag you control: a small expense ratio compounds against you.
 *  • Inflation, the invisible tax: the buying power a dollar loses over time.
 *  • The tax drag: tax paid along the way never compounds again.
 *  • Asset location: which account holds what, for a free after-tax win.
 *  • Volatility drag: why daily-reset leveraged funds bleed in choppy markets.
 * (Tax drag and asset location are US-focused — see the page's region note.)
 * Non-default tabs are code-split (fetched on first open).
 */
export default function ReturnDrainsModule() {
  return (
    <ModuleTabs
      label="What quietly eats your returns"
      tabs={[
        { id: "fees", label: "Fees: the drag you control", render: () => <FeesLab /> },
        { id: "inflation", label: "Inflation: the invisible tax", load: () => import("./InflationLab") },
        { id: "tax-drag", label: "The tax drag", load: () => import("./TaxDragLab") },
        { id: "asset-location", label: "Asset location", load: () => import("./AssetLocationLab") },
        { id: "leverage", label: "Volatility drag: the 2× trap", load: () => import("./LeverageLab") },
      ]}
    />
  );
}
