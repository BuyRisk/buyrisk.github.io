import ModuleTabs from "./ModuleTabs";
import CapmLab from "./CapmLab";
import FactorLab from "./FactorLab";

/**
 * Risk & return module: how markets price risk, in two steps.
 *  • CAPM — one risk is priced: the market's, measured by beta.
 *  • Factors — the Fama-French extension: size, value, profitability, investment
 *    explain what CAPM called "alpha."
 */
export default function CapmFactorsModule() {
  return (
    <ModuleTabs
      label="From one factor to many"
      tabs={[
        { id: "capm", label: "CAPM — the price of market risk", render: () => <CapmLab /> },
        { id: "factors", label: "Factors — beyond beta", render: () => <FactorLab /> },
      ]}
    />
  );
}
