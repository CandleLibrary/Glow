import { Animation } from "./animation";

function setTo(to, seq, duration, easing){

    let cs = window.getComputedStyle(to, null);
    
    var rect = to.getBoundingClientRect();
    let to_width = cs.getPropertyValue("width");
    let to_height = cs.getPropertyValue("height");
    let margin_left = parseFloat(cs.getPropertyValue("margin-left"));
    let to_bgc = cs.getPropertyValue("background-color");

    let left = seq.props.left, offl = to.offsetLeft - margin_left;
    let left_diff = (left.keys[0].val) - (rect.left);

    left.keys[0].val = new left.type(offl + left_diff, "px");
    left.keys[1].val = new left.type(offl,"px");

    left.keys[1].dur = duration;
    left.keys[1].len = duration;
    left.keys[1].ease = easing;
    left.duration = duration;

    let top = seq.props.top;
    let top_diff = top.keys[0].val - rect.top;
    top.keys[0].val = new top.type(to.offsetTop + top_diff, "px");
    top.keys[1].val = new top.type(to.offsetTop ,"px");
    top.keys[1].dur = duration;
    top.keys[1].len = duration;
    top.keys[1].ease = easing;
    top.duration = duration;


    seq.props.width.keys[0].val = new seq.props.width.type(to_width);
    seq.props.width.keys[0].dur = duration;
    seq.props.width.keys[0].len = duration;
    seq.props.width.keys[0].ease = easing;
    seq.props.width.duration = duration;

    seq.props.height.keys[0].val = new seq.props.height.type(to_height);
    seq.props.height.keys[0].dur = duration;
    seq.props.height.keys[0].len = duration; 
    seq.props.height.keys[0].ease = easing; 
    seq.props.height.duration = duration;

    seq.props.backgroundColor.keys[0].val = new seq.props.backgroundColor.type(to_bgc);
    seq.props.backgroundColor.keys[0].dur = duration; 
    seq.props.backgroundColor.keys[0].len = duration; 
    seq.props.backgroundColor.keys[0].ease = easing; 
    seq.props.backgroundColor.duration = duration;

    seq.obj = to;

    seq.addEventListener("stopped", ()=>{
        debugger
    });
}

/**
    Transform one element from another back to itself
    @alias module:wick~internals.TransformTo
*/
export function TransformTo(element_from, element_to, duration = 500, easing = Animation.easing.linear, HIDE_OTHER) {
    let rect = element_from.getBoundingClientRect();
    let cs = window.getComputedStyle(element_from, null);
    let margin_left = parseFloat(cs.getPropertyValue("margin"));

    let seq = Animation.createSequence({
        obj: element_from,
        width: { value: "0px"},
        height: { value: "0px"},
        backgroundColor: { value: "rgb(1,1,1)"},
        left: [{value:rect.left+"px"},{ value: "0px"}],
        top: [{value:rect.top+"px"},{ value: "0px"}]
    });

    if (!element_to) {

        let a = (seq) => (element_to, duration = 500, easing = Animation.easing.linear,  HIDE_OTHER = false) => {
            setTo(element_to, seq, duration, easing);
            seq.duration = duration;
            return seq;
        };

        return a(seq);
    }

    setTo(element_to, duration, easing);
    seq.duration = duration;
    return seq;
}