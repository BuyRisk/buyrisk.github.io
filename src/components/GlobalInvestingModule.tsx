import ModuleTabs from "./ModuleTabs";
import HomeBiasLab from "./HomeBiasLab";
import RollingReturnsLab from "./RollingReturnsLab";
import CurrencyRiskLab from "./CurrencyRiskLab";

/**
 * Global Investing module: owning the whole world, not just home.
 *  • Home bias: how small a slice of the world your home market really is.
 *  • US vs. the world: the multi-year leadership cycle you can't time.
 *  • Currency risk: when hedging a foreign holding is worth the trouble.
 */
export default function GlobalInvestingModule() {
  return (
    <ModuleTabs
      label="Investing globally"
      tabs={[
        { id: "home-bias", label: "Home bias", render: () => <HomeBiasLab /> },
        { id: "us-vs-world", label: "US vs. the world", render: () => <RollingReturnsLab /> },
        { id: "currency", label: "Currency risk", render: () => <CurrencyRiskLab /> },
      ]}
    />
  );
}
