import { CBezier } from "@candlefw/math";
import Spark from "@candlefw/spark";
import css from "@candlefw/css";

const CSS_Length = css.types.length;
const CSS_Percentage = css.types.percentage;
const CSS_Color = css.types.color;
const CSS_Transform2D = css.types.transform2D;
const CSS_Path = css.types.path;

const Animation = (function anim() {
    var USE_TRANSFORM = false;
    const
        CSS_STYLE = 0,
        JS_OBJECT = 1,
        SVG = 3;

    function setType(obj) {
        if (obj instanceof HTMLElement) {
            if (obj.tagName == "SVG")
                return SVG;
            return CSS_STYLE;
        }
        return JS_OBJECT;
    }

    const Linear = { getYatX: x => x };

    /**
     * Class to linearly interpolate number.
     */
    class lerpNumber extends Number { lerp(to, t) { return this + (to - this) * t; } copy(val) { return new lerpNumber(val); } }

    /**
     * Store animation data for a single property on a single object. 
     * @class      AnimProp (name)
     */
    class AnimProp {
        constructor(keys, obj, prop_name, type) {

            this.duration = 0;
            this.end = false;
            this.keys = [];
            this.current_val = null;

            let IS_ARRAY = Array.isArray(keys);

            if (prop_name == "transform")
                this.type = CSS_Transform2D;
            else
                this.type = (IS_ARRAY) ? this.getType(keys[0].value) : this.getType(keys.value);

            this.getValue(obj, prop_name, type);

            let p = this.current_val;

            if (IS_ARRAY) {
                keys.forEach(k => p = this.addKey(k, p));
            } else
                this.addKey(keys, p);
        }

        destroy() {
            this.keys = null;
            this.type = null;
            this.current_val = null;
        }

        getValue(obj, prop_name, type) {
            if (type == CSS_STYLE) {
                let name = prop_name.replace(/[A-Z]/g, (match) => "-" + match.toLowerCase());
                let cs = window.getComputedStyle(obj);
                let value = cs.getPropertyValue(name);

                if (this.type == CSS_Percentage) {
                    if (obj.parentElement) {
                        let pcs = window.getComputedStyle(obj.parentElement);
                        let pvalue = pcs.getPropertyValue(name);
                        let ratio = parseFloat(value) / parseFloat(pvalue);
                        value = (ratio * 100);
                    }
                }

                this.current_val = new this.type(value);

            } else {
                this.current_val = new this.type(obj[prop_name]);
            }
        }

        getType(value) {
            if (typeof(value) === "number")
                return lerpNumber;
            if (CSS_Length._verify_(value))
                return CSS_Length;
            if (CSS_Percentage._verify_(value))
                return CSS_Percentage;
            if (CSS_Color._verify_(value))
                return CSS_Color;
            return lerpNumber;
        }

        addKey(key, prev) {
            let l = this.keys.length;
            let pkey = this.keys[l - 1];
            let v = (key.value !== undefined) ? key.value : key.v;
            let own_key = {
                val: (prev) ? prev.copy(v) : new this.type(v) || 0,
                dur: key.duration || key.dur || 0,
                del: key.delay || key.del || 0,
                ease: key.easing || key.e || ((pkey) ? pkey.ease : Linear),
                len: 0
            };

            own_key.len = own_key.dur + own_key.del;

            this.keys.push(own_key);

            this.duration += own_key.len;

            return own_key.val;
        }

        run(obj, prop_name, time, type) {
            let val_start = this.current_val,
                val_end = this.current_val,
                key, val_out = val_start,
                in_range = time < this.duration;

            for (let i = 0; i < this.keys.length; i++) {
                key = this.keys[i];
                val_end = key.val;
                if (time < key.len) {
                    break;
                } else
                    time -= key.len;
                val_start = key.val;
            }


            if (key) {
                if (time < key.len) {
                    if (time < key.del) {
                        val_out = val_start;
                    } else {
                        let x = (time - key.del) / key.dur;
                        let s = key.ease.getYatX(x);
                        val_out = val_start.lerp(val_end, s);
                    }
                } else {
                    val_out = val_end;
                }
            }

            this.setProp(obj, prop_name, val_out, type);

            return in_range;
        }

        setProp(obj, prop_name, value, type) {

            if (type == CSS_STYLE) {
                obj.style[prop_name] = value;
            } else
                obj[prop_name] = value;
        }

        unsetProp(obj, prop_name){
            this.setProp(obj, prop_name, "", CSS_STYLE)
        }
    }


    /**
     * Stores animation data for a group of properties. Defines delay and repeat.
     * @class      AnimSequence (name)
     */
    class AnimSequence {
        constructor(obj, props) {
            this.duration = 0;
            this.time = 0;
            this.type = setType(obj);
            this.obj = null;
            this.DESTROYED = false;
            this.FINISHED = false;
            this.events = {};

            switch (this.type) {
                case CSS_STYLE:
                    this.obj = obj;
                    break;
                case SVG:
                case JS_OBJECT:
                    this.obj = obj;
                    break;
            }

            this.props = {};

            this.setProps(props);
        }

        destroy() {
            for (let name in this.props)
                if (this.props[name])
                    this.props[name].destroy();
            this.DESTROYED = true;
            this.duration = 0;
            this.obj = null;
            this.props = null;
            this.time = 0;
        }

        /**
         * Removes AnimProps based on object of keys that should be removed from this sequence.
         */
        removeProps(props) {
            if (props instanceof AnimSequence)
                props = props.props;

            for (let name in props) {
                if (this.props[name])
                    this.props[name] = null;
            }
        }

        unsetProps(props){
            for (let name in this.props)
                this.props[name].unsetProp(this.obj, name);
        }

        /**
         * Sets the properties.
         *
         * @param      {<type>}  props   The properties
         */
        setProps(props) {
            for (let name in this.props)
                this.props[name].destroy();

            this.props = {};

            for (let name in props)
                this.configureProp(name, props[name]);
        }

        configureProp(name, keys) {
            let prop;
            if (prop = this.props[name]) {
                this.duration = Math.max(prop.duration, this.duration);
            } else {
                prop = new AnimProp(keys, this.obj, name, this.type);
                this.props[name] = prop;
                this.duration = Math.max(prop.duration, this.duration);
            }
        }

        run(i) {

            for (let n in this.props) {
                let prop = this.props[n];
                if (prop)
                    prop.run(this.obj, n, i, this.type);
            }

            if (i >= this.duration)
                return false;

            return true;
        }

        scheduledUpdate(a, t) {
            if (this.run(this.time += t))
                Spark.queueUpdate(this);
            else
                this.issueEvent("stopped");
        }

        play(from = 0) {
            this.time = from;
            Spark.queueUpdate(this);
            this.issueEvent("started");
        }

        addEventListener(event, listener) {
            if (typeof(listener) === "function") {
                if (!this.events[event])
                    this.events[event] = [];
                this.events[event].push(listener);
            }
        }

        removeEventListener(event, listener) {
            if (typeof(listener) === "function") {
                let events = this.events[event];
                if (events) {
                    for (let i = 0; i < events.length; i++)
                        if (events[i] === listener)
                            return e(vents.splice(i, 1), true);
                }
            }
            return false;
        }

        issueEvent(event) {
            let events = this.events[event];

            if (events)
                events.forEach(e => e(this));
        }
    }

    class AnimGroup {
        constructor() {
            this.seq = [];
            this.time = 0;
            this.duration = 0;
        }

        destroy() {
            this.seq.forEach(seq => seq.destroy());
            this.seq = null;
        }

        add(seq) {
            this.seq.push(seq);
            this.duration = Math.max(this.duration, seq.duration);
        }

        run(t) {
            for (let i = 0, l = this.seq.length; i < l; i++) {
                let seq = this.seq[i];
                seq.run(t);
            }

            if (t >= this.duration)
                return false;

            return true;
        }

        scheduledUpdate(a, t) {
        	this.time += t
            if (this.run(this.time))
                Spark.queueUpdate(this);
        }

        play(from = 0) {
            this.time = 0;
            Spark.queueUpdate(this);
        }
    }

    return {
        createSequence: function() {

            if (arguments.length > 1) {

                let group = new AnimGroup();

                for (let i = 0; i < arguments.length; i++) {
                    let data = arguments[i];

                    let obj = data.obj;
                    let props = {};

                    Object.keys(data).forEach(k => { if (!(({ obj: true, match: true })[k])) props[k] = data[k]; });

                    group.add(new AnimSequence(obj, props));
                }

                return group;

            } else {
                let data = arguments[0];

                let obj = data.obj;
                let props = {};

                Object.keys(data).forEach(k => { if (!(({ obj: true, match: true })[k])) props[k] = data[k]; });

                let seq = new AnimSequence(obj, props);

                return seq;
            }
        },

        createGroup: function(...rest) {
            let group = new AnimGroup;
            rest.forEach(seq => group.add(seq));
            return group;
        },

        set USE_TRANSFORM(v) { USE_TRANSFORM = !!v; },
        
        get USE_TRANSFORM() { return USE_TRANSFORM; },
        
        easing: {
            linear: Linear,
            ease: new CBezier(0.25, 0.1, 0.25, 1),
            ease_in: new CBezier(0.42, 0, 1, 1),
            ease_out: new CBezier(0.2, 0.8, 0.3, 0.99),
            ease_in_out: new CBezier(0.42, 0, 0.58, 1),
            overshoot: new CBezier(0.2, 1.5, 0.2, 0.8)
        }
    };
})();

export { Animation };