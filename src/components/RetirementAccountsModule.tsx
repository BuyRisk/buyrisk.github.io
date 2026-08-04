import ModuleTabs from "./ModuleTabs";
import SocialSecurityLab from "./SocialSecurityLab";
import RothLab from "./RothLab";

/**
 * Retirement Accounts module (Personal Finance): the two big US account
 * decisions, split out from the investing-side "will my money last" sim.
 *  • Social Security: when to claim the guaranteed, inflation-adjusted income.
 *  • Roth vs Traditional: which account, and the employer match to grab first.
 */
export default function RetirementAccountsModule() {
  return (
    <ModuleTabs
      label="Your retirement accounts"
      tabs={[
        { id: "ss", label: "When to claim Social Security", render: () => <SocialSecurityLab /> },
        { id: "roth", label: "Roth or Traditional?", render: () => <RothLab /> },
      ]}
    />
  );
}
