import ModuleTabs from "./ModuleTabs";
import RiskReturnLab from "./RiskReturnLab";
import CapmLab from "./CapmLab";
import FactorLab from "./FactorLab";

/**
 * Risk & return module: how markets price risk, from the ground up.
 *  • The big idea: return is the reward for risk (asset classes on a σ–return
 *    plot), plus the low-beta paradox where the reward doesn't scale.
 *  • CAPM: only one risk is priced, the market's, measured by beta.
 *  • Factors, the Fama-French extension: size, value, profitability, investment
 *    explain what CAPM called "alpha."
 */
export default function CapmFactorsModule() {
  return (
    <ModuleTabs
      label="Pick a view — risk and return, step by step"
      tabs={[
        { id: "risk", label: "Risk & return: the big idea", render: () => <RiskReturnLab /> },
        { id: "capm", label: "CAPM: the price of market risk", render: () => <CapmLab /> },
        { id: "factors", label: "Factors: beyond beta", render: () => <FactorLab /> },
      ]}
    />
  );
}
