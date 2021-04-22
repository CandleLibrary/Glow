import { addModuleToCFW } from "@candlefw/cfw";

import { Animation } from "./animation.js";
import { Transition, Transitioneer } from "./transitioneer.js";
import { TransformTo } from "./transformto.js";

Object.assign(Animation, {
	createTransition: Transitioneer.createTransition,
	transformTo: TransformTo
});

addModuleToCFW(Animation, "glow");

export { Transition };
export default Animation;
