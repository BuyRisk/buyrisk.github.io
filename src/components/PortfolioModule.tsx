import ModuleTabs from "./ModuleTabs";
import PortfolioLab from "./PortfolioLab";
import AssetAllocationLab from "./AssetAllocationLab";
import BondLab from "./BondLab";

/**
 * Portfolio, Allocation & Bonds module: building the actual portfolio.
 *  • Build a portfolio: mix assets, watch correlations and the efficient frontier.
 *  • How much in stocks? The stock/bond dial and its risk/return trade-off.
 *  • Bonds & rates: why the "safe" sleeve moves when interest rates do.
 */
export default function PortfolioModule() {
  return (
    <ModuleTabs
      label="Build the portfolio"
      tabs={[
        { id: "frontier", label: "Mix assets (the frontier)", render: () => <PortfolioLab /> },
        { id: "allocation", label: "How much in stocks?", render: () => <AssetAllocationLab /> },
        { id: "bonds", label: "Bonds & interest-rate risk", render: () => <BondLab /> },
      ]}
    />
  );
}
