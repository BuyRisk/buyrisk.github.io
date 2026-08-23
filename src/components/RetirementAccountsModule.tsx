import ModuleTabs from "./ModuleTabs";
import SocialSecurityLab from "./SocialSecurityLab";

/**
 * Retirement Accounts module (Personal Finance): the big US account decisions,
 * split out from the investing-side "will my money last" sim.
 *  • Social Security: when to claim the guaranteed, inflation-adjusted income.
 *  • Roth vs Traditional: which account, and the employer match to grab first.
 *  • Harvest or convert: how to spend a low-income year's cheap tax space —
 *    0%-zone gain harvesting vs Roth conversions, which compete for one ladder.
 * Non-default tabs are code-split (fetched on first open).
 */
export default function RetirementAccountsModule() {
  return (
    <ModuleTabs
      label="Your retirement accounts"
      tabs={[
        { id: "ss", label: "When to claim Social Security", render: () => <SocialSecurityLab /> },
        { id: "roth", label: "Roth or Traditional?", load: () => import("./RothLab") },
        { id: "harvest", label: "Harvest gains or convert?", load: () => import("./HarvestConvertLab") },
      ]}
    />
  );
}
