import ModuleTabs from "./ModuleTabs";
import CompoundGrowthExplorer from "./CompoundGrowthExplorer";
import SavingsRateLab from "./SavingsRateLab";
import DebtLab from "./DebtLab";

/**
 * Growth, Savings & Debt module: compounding in every direction.
 *  • Compound growth: how contributions, return, and time build wealth.
 *  • Savings rate: the rate (not the income) that sets your timeline to freedom.
 *  • Debt: compounding in reverse, working against you.
 */
export default function GrowthModule() {
  return (
    <ModuleTabs
      label="Compounding, in every direction"
      tabs={[
        { id: "growth", label: "Compound growth", render: () => <CompoundGrowthExplorer /> },
        { id: "savings", label: "Savings rate → freedom", render: () => <SavingsRateLab /> },
        { id: "debt", label: "The cost of debt", render: () => <DebtLab /> },
      ]}
    />
  );
}
