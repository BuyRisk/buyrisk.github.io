import ModuleTabs from "./ModuleTabs";
import PortfolioLab from "./PortfolioLab";

/**
 * Portfolio, Allocation & Bonds module: building and maintaining the portfolio.
 *  • Build a portfolio: mix assets, watch correlations and the efficient frontier.
 *  • How much in stocks? The stock/bond dial and its risk/return trade-off.
 *  • Bonds & rates: why the "safe" sleeve moves when interest rates do.
 *  • Rebalancing: how drift changes the risk you actually hold, and the fix.
 * Non-default tabs are code-split (fetched on first open).
 */
export default function PortfolioModule() {
  return (
    <ModuleTabs
      label="Build and maintain the portfolio"
      tabs={[
        { id: "frontier", label: "Mix assets (the frontier)", render: () => <PortfolioLab /> },
        { id: "allocation", label: "How much in stocks?", load: () => import("./AssetAllocationLab") },
        { id: "bonds", label: "Bonds & interest-rate risk", load: () => import("./BondLab") },
        { id: "rebalance", label: "Rebalancing: discipline vs. drift", load: () => import("./RebalanceLab") },
      ]}
    />
  );
}
