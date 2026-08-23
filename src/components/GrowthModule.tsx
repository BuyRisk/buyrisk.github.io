import ModuleTabs from "./ModuleTabs";
import CompoundGrowthExplorer from "./CompoundGrowthExplorer";

/**
 * Growth, Savings & Debt module: compounding in every direction.
 *  • Compound growth: how contributions, return, and time build wealth.
 *  • Savings rate: the rate (not the income) that sets your timeline to independence.
 *  • Twin lives: identical savers, different start decades — luck vs discipline.
 *  • Debt: compounding in reverse, working against you.
 * Non-default tabs are code-split (fetched on first open).
 */
export default function GrowthModule() {
  return (
    <ModuleTabs
      label="Compounding, in every direction"
      tabs={[
        { id: "growth", label: "Compound growth", render: () => <CompoundGrowthExplorer /> },
        { id: "savings", label: "Savings rate → independence", load: () => import("./SavingsRateLab") },
        { id: "twins", label: "Twin lives", load: () => import("./TwinLivesLab") },
        { id: "debt", label: "The cost of debt", load: () => import("./DebtLab") },
      ]}
    />
  );
}
