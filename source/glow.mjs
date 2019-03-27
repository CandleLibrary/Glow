import { Animation } from "./animation";
import { Transitioneer } from "./transitioneer";
import { TransformTo } from "./transformto";

Object.assign(Animation, {
	createTransition:(...args) => Transitioneer.createTransition(...args),
	transformTo:(...args) => TransformTo(...args)
});

export default Animation;
