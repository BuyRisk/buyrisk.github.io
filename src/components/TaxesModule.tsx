import ModuleTabs from "./ModuleTabs";
import TaxDragLab from "./TaxDragLab";
import AssetLocationLab from "./AssetLocationLab";

/**
 * Taxes module: what a taxable account costs, and how to blunt it.
 *  • The tax drag: the leak that compounds against a taxable account.
 *  • Asset location: which account holds bonds vs. stocks, for a free tax win.
 */
export default function TaxesModule() {
  return (
    <ModuleTabs
      label="Tax efficiency"
      tabs={[
        { id: "tax-drag", label: "The tax drag", render: () => <TaxDragLab /> },
        { id: "asset-location", label: "Asset location", render: () => <AssetLocationLab /> },
      ]}
    />
  );
}
