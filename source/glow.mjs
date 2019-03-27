import { Animation } from "./animation";
import { Transitioneer } from "./transitioneer";
import { TransformTo } from "./transformto";

export { Transitioneer, TransformTo, Animation };

Object.assign(Animation, {
	createTransition:(...args) => Transitioneer.createTransition(...args),
	transformTo:(...args) => TransformTo(...args)
});

export default Animation;
