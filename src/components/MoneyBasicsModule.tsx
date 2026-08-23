import ModuleTabs from "./ModuleTabs";
import BudgetLab from "./BudgetLab";

/**
 * Money Basics module (Personal Finance): the five foundation calculators,
 * consolidated from their former standalone pages, in learning order.
 *  • Budget: know where the money goes (and carve out the invested slice).
 *  • Emergency fund: the buffer that keeps a surprise from becoming debt.
 *  • Savings goal: put a number and a date on it.
 *  • Net worth: the one number that tracks the whole picture.
 *  • Debt payoff: avalanche vs snowball on your own debts.
 * Non-default tabs are code-split (fetched on first open).
 */
export default function MoneyBasicsModule() {
  return (
    <ModuleTabs
      label="The foundations, in order"
      tabs={[
        { id: "budget", label: "The 50/30/20 budget", render: () => <BudgetLab /> },
        { id: "emergency", label: "Emergency fund", load: () => import("./EmergencyFundLab") },
        { id: "goal", label: "Savings goal", load: () => import("./SavingsGoalLab") },
        { id: "net-worth", label: "Net worth", load: () => import("./NetWorthLab") },
        { id: "debt", label: "Debt payoff", load: () => import("./DebtPayoffLab") },
      ]}
    />
  );
}
