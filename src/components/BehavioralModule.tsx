import ModuleTabs from "./ModuleTabs";
import BehavioralLab from "./BehavioralLab";

/**
 * Behavioral Finance module: the evidence, then the mirror.
 *  • Your own worst enemy: the behavior gap — panic-selling priced over real
 *    history, the CRSP fund-level gaps, and the field guide to the biases.
 *  • The Bias Arcade: eight short experiments that run the classic studies on
 *    YOU — play first, see the bias named after, remedies linked.
 * Non-default tabs are code-split (fetched on first open).
 */
export default function BehavioralModule() {
  return (
    <ModuleTabs
      label="The evidence — then the mirror"
      tabs={[
        { id: "gap", label: "Your own worst enemy", render: () => <BehavioralLab /> },
        { id: "arcade", label: "🕹 The Bias Arcade: test yourself", load: () => import("./arcade/BiasArcade") },
      ]}
    />
  );
}
