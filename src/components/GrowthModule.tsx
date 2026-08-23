import ModuleTabs from "./ModuleTabs";
import CompoundGrowthExplorer from "./CompoundGrowthExplorer";
import SavingsRateLab from "./SavingsRateLab";
import DebtLab from "./DebtLab";
import TwinLivesLab from "./TwinLivesLab";

/**
 * Growth, Savings & Debt module: compounding in every direction.
 *  • Compound growth: how contributions, return, and time build wealth.
 *  • Savings rate: the rate (not the income) that sets your timeline to independence.
 *  • Twin lives: identical savers, different start decades — luck vs discipline.
 *  • Debt: compounding in reverse, working against you.
 */
export default function GrowthModule() {
  return (
    <ModuleTabs
      label="Compounding, in every direction"
      tabs={[
        { id: "growth", label: "Compound growth", render: () => <CompoundGrowthExplorer /> },
        { id: "savings", label: "Savings rate → independence", render: () => <SavingsRateLab /> },
        { id: "twins", label: "Twin lives", render: () => <TwinLivesLab /> },
        { id: "debt", label: "The cost of debt", render: () => <DebtLab /> },
      ]}
    />
  );
}
