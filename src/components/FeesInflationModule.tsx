import ModuleTabs from "./ModuleTabs";
import FeesLab from "./FeesLab";
import InflationLab from "./InflationLab";

/**
 * "The silent drains" module: the two forces that quietly erode returns.
 *  • Fees — the drag you control: a small expense ratio compounds against you.
 *  • Inflation — the drag you don't: the buying power a dollar loses over time.
 */
export default function FeesInflationModule() {
  return (
    <ModuleTabs
      label="Two silent drains on your money"
      tabs={[
        { id: "fees", label: "Fees — the drag you control", render: () => <FeesLab /> },
        { id: "inflation", label: "Inflation — the drag you don't", render: () => <InflationLab /> },
      ]}
    />
  );
}
