import { AnimationInterpolation } from "./types";

export interface AnimationProp {

    [key: number]: AnimationProp,
    v?: any,
    value?: any,
    dur?: number,
    duration?: number,
    delay?: number;
    del?: number;
    easing?: AnimationInterpolation;
    e?: AnimationInterpolation;
    forEach(arg: (arg: AnimationProp) => any): any;

}

export interface AnimationProps {
    [key: string]: AnimationProp;
}

export interface AnimateObject {
    /**
     * Any object with properties that can be animated.
     */
    obj: any;

    match?: any;

    delay?: number;

    [key: string]: AnimationProp;
}
