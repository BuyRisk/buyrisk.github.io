import ModuleTabs from "./ModuleTabs";
import HomeBiasLab from "./HomeBiasLab";

/**
 * Global Investing module: owning the whole world, not just home.
 *  • Home bias: how small a slice of the world your home market really is.
 *  • US vs. the world: the multi-year leadership cycle you can't time.
 *  • Currency risk: when hedging a foreign holding is worth the trouble.
 * Non-default tabs are code-split (fetched on first open).
 */
export default function GlobalInvestingModule() {
  return (
    <ModuleTabs
      label="Investing globally"
      tabs={[
        { id: "home-bias", label: "Home bias", render: () => <HomeBiasLab /> },
        { id: "us-vs-world", label: "US vs. the world", load: () => import("./RollingReturnsLab") },
        { id: "currency", label: "Currency risk", load: () => import("./CurrencyRiskLab") },
      ]}
    />
  );
}
