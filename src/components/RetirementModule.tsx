import ModuleTabs from "./ModuleTabs";
import BurnRateLab from "./BurnRateLab";
import SocialSecurityLab from "./SocialSecurityLab";
import RothLab from "./RothLab";

/**
 * Retirement & Roth module: funding and drawing down the nest egg.
 *  • Burn rate: what retirement costs, the nest egg it implies, and whether it lasts.
 *  • Social Security: when to claim the guaranteed inflation-adjusted income.
 *  • Roth vs Traditional: which account, and the employer match to grab first.
 */
export default function RetirementModule() {
  return (
    <ModuleTabs
      label="Funding and spending your retirement"
      tabs={[
        { id: "burn", label: "What will it cost?", render: () => <BurnRateLab /> },
        { id: "ss", label: "When to claim Social Security", render: () => <SocialSecurityLab /> },
        { id: "roth", label: "Roth or Traditional?", render: () => <RothLab /> },
      ]}
    />
  );
}
