var glow = (function () {
    'use strict';

    /**
     * Used to call the Scheduler after a JavaScript runtime tick.
     *
     * Depending on the platform, caller will either map to requestAnimationFrame or it will be a setTimout.
     */
     
    const caller = (typeof(window) == "object" && window.requestAnimationFrame) ? window.requestAnimationFrame : (f) => {
        setTimeout(f, 1);
    };

    const perf = (typeof(performance) == "undefined") ? { now: () => Date.now() } : performance;


    /**
     * Handles updating objects. It does this by splitting up update cycles, to respect the browser event model. 
     *    
     * If any object is scheduled to be updated, it will be blocked from scheduling more updates until the next ES VM tick.
     */
    class Spark {
        /**
         * Constructs the object.
         */
        constructor() {

            this.update_queue_a = [];
            this.update_queue_b = [];

            this.update_queue = this.update_queue_a;

            this.queue_switch = 0;

            this.callback = ()=>{};


            if(typeof(window) !== "undefined"){
                window.addEventListener("load",()=>{
                    this.callback = () => this.update();
                    caller(this.callback);
                });
            }else{
                this.callback = () => this.update();
            }


            this.frame_time = perf.now();

            this.SCHEDULE_PENDING = false;
        }

        /**
         * Given an object that has a _SCHD_ Boolean property, the Scheduler will queue the object and call its .update function 
         * the following tick. If the object does not have a _SCHD_ property, the Scheduler will persuade the object to have such a property.
         * 
         * If there are currently no queued objects when this is called, then the Scheduler will user caller to schedule an update.
         */
        queueUpdate(object, timestart = 1, timeend = 0) {

            if (object._SCHD_ || object._SCHD_ > 0) {
                if (this.SCHEDULE_PENDING)
                    return;
                else
                    return caller(this.callback);
            }

            object._SCHD_ = ((timestart & 0xFFFF) | ((timeend) << 16));

            this.update_queue.push(object);

            if (this._SCHD_)
                return;

            this.frame_time = perf.now() | 0;


            if(!this.SCHEDULE_PENDING){
                this.SCHEDULE_PENDING = true;
                caller(this.callback);
            }
        }

        removeFromQueue(object){

            if(object._SCHD_)
                for(let i = 0, l = this.update_queue.length; i < l; i++)
                    if(this.update_queue[i] === object){
                        this.update_queue.splice(i,1);
                        object._SCHD_ = 0;

                        if(l == 1)
                            this.SCHEDULE_PENDING = false;

                        return;
                    }
        }

        /**
         * Called by the caller function every tick. Calls .update on any object queued for an update. 
         */
        update() {

            this.SCHEDULE_PENDING = false;

            const uq = this.update_queue;
            const time = perf.now() | 0;
            const diff = Math.ceil(time - this.frame_time) | 1;
            const step_ratio = (diff * 0.06); //  step_ratio of 1 = 16.66666666 or 1000 / 60 for 60 FPS

            this.frame_time = time;
            
            if (this.queue_switch == 0)
                (this.update_queue = this.update_queue_b, this.queue_switch = 1);
            else
                (this.update_queue = this.update_queue_a, this.queue_switch = 0);

            for (let i = 0, l = uq.length, o = uq[0]; i < l; o = uq[++i]) {
                let timestart = ((o._SCHD_ & 0xFFFF)) - diff;
                let timeend = ((o._SCHD_ >> 16) & 0xFFFF);

                o._SCHD_ = 0;
                
                if (timestart > 0) {
                    this.queueUpdate(o, timestart, timeend);
                    continue;
                }

                timestart = 0;

                if (timeend > 0) 
                    this.queueUpdate(o, timestart, timeend - diff);

                /** 
                    To ensure on code path doesn't block any others, 
                    scheduledUpdate methods are called within a try catch block. 
                    Errors by default are printed to console. 
                **/
                try {
                    o.scheduledUpdate(step_ratio, diff);
                } catch (e) {
                    console.error(e);
                }
            }

            uq.length = 0;
        }
    }

    const spark = new Spark();

    /**
     * To be extended by objects needing linked list methods.
     */
    const LinkedList = {

        props: {
            /**
             * Properties for horizontal graph traversal
             * @property {object}
             */
            defaults: {
                /**
                 * Next sibling node
                 * @property {object | null}
                 */
                nxt: null,

                /**
                 * Previous sibling node
                 * @property {object | null}
                 */
                prv: null
            },

            /**
             * Properties for vertical graph traversal
             * @property {object}
             */
            children: {
                /**
                 * Number of children nodes.
                 * @property {number}
                 */
                noc: 0,
                /**
                 * First child node
                 * @property {object | null}
                 */
                fch: null,
            },
            parent: {
                /**
                 * Parent node
                 * @property {object | null}
                 */
                par: null
            }
        },

        methods: {
            /**
             * Default methods for Horizontal traversal
             */
            defaults: {

                insertBefore: function(node) {

                    if (!this.nxt && !this.prv) {
                        this.nxt = this;
                        this.prv = this;
                    }

                    if(node){
                        if (node.prv)
                           node.prv.nxt = node.nxt;
                        
                        if(node.nxt) 
                            node.nxt.prv = node.prv;
                    
                        node.prv = this.prv;
                        node.nxt = this;
                        this.prv.nxt = node;
                        this.prv = node;
                    }else{
                        if (this.prv)
                            this.prv.nxt = node;
                        this.prv = node;
                    } 
                },

                insertAfter: function(node) {

                    if (!this.nxt && !this.prv) {
                        this.nxt = this;
                        this.prv = this;
                    }

                    if(node){
                        if (node.prv)
                           node.prv.nxt = node.nxt;
                        
                        if(node.nxt) 
                            node.nxt.prv = node.prv;
                    
                        node.nxt = this.nxt;
                        node.prv = this;
                        this.nxt.prv = node;
                        this.nxt = node;
                    }else{
                        if (this.nxt)
                            this.nxt.prv = node;
                        this.nxt = node;
                    } 
                }
            },
            /**
             * Methods for both horizontal and vertical traversal.
             */
            parent_child: {
                /**
                 *  Returns eve. 
                 * @return     {<type>}  { description_of_the_return_value }
                 */
                root() {
                    return this.eve();
                },
                /**
                 * Returns the root node. 
                 * @return     {Object}  return the very first node in the linked list graph.
                 */
                eve() {
                    if (this.par)
                        return this.par.eve();
                    return this;
                },

                push(node) {
                    this.addChild(node);
                },

                unshift(node) {
                    this.addChild(node, (this.fch) ? this.fch.pre : null);
                },

                replace(old_node, new_node) {
                    if (old_node.par == this && old_node !== new_node) {
                        if (new_node.par) new_node.par.remove(new_node);

                        if (this.fch == old_node) this.fch = new_node;
                        new_node.par = this;


                        if (old_node.nxt == old_node) {
                            new_node.nxt = new_node;
                            new_node.prv = new_node;
                        } else {
                            new_node.prv = old_node.prv;
                            new_node.nxt = old_node.nxt;
                            old_node.nxt.prv = new_node;
                            old_node.prv.nxt = new_node;
                        }

                        old_node.par = null;
                        old_node.prv = null;
                        old_node.nxt = null;
                    }
                },

                insertBefore: function(node) {
                    if (this.par)
                        this.par.addChild(node, this.pre);
                    else
                        LinkedList.methods.defaults.insertBefore.call(this, node);
                },

                insertAfter: function(node) {
                    if (this.par)
                        this.par.addChild(node, this);
                    else
                        LinkedList.methods.defaults.insertAfter.call(this, node);
                },

                addChild: function(child = null, prev = null) {

                    if (!child) return;

                    if (child.par)
                        child.par.removeChild(child);

                    if (prev && prev.par && prev.par == this) {
                        if (child == prev) return;
                        child.prv = prev;
                        prev.nxt.prv = child;
                        child.nxt = prev.nxt;
                        prev.nxt = child;
                    } else if (this.fch) {
                        child.prv = this.fch.prv;
                        this.fch.prv.nxt = child;
                        child.nxt = this.fch;
                        this.fch.prv = child;
                    } else {
                        this.fch = child;
                        child.nxt = child;
                        child.prv = child;
                    }

                    child.par = this;
                    this.noc++;
                },

                /**
                 * Analogue to HTMLElement.removeChild()
                 *
                 * @param      {HTMLNode}  child   The child
                 */
                removeChild: function(child) {
                    if (child.par && child.par == this) {
                        child.prv.nxt = child.nxt;
                        child.nxt.prv = child.prv;

                        if (child.prv == child || child.nxt == child) {
                            if (this.fch == child)
                                this.fch = null;
                        } else if (this.fch == child)
                            this.fch = child.nxt;

                        child.prv = null;
                        child.nxt = null;
                        child.par = null;
                        this.noc--;
                    }
                },

                /**
                 * Gets the next node. 
                 *
                 * @param      {HTMLNode}  node    The node to get the sibling of.
                 * @return {HTMLNode | TextNode | undefined}
                 */
                getNextChild: function(node = this.fch) {
                    if (node && node.nxt != this.fch && this.fch)
                        return node.nxt;
                    return null;
                },

                /**
                 * Gets the child at index.
                 *
                 * @param      {number}  index   The index
                 */
                getChildAtIndex: function(index, node = this.fch) {
                    if(node.par !== this)
                        node = this.fch;

                    let first = node;
                    let i = 0;
                    while (node && node != first) {
                        if (i++ == index)
                            return node;
                        node = node.nxt;
                    }

                    return null;
                },
            }
        },

        gettersAndSetters : {
            peer : {
                next: {
                    enumerable: true,
                    configurable: true,
                    get: function() {
                        return this.nxt;
                    },
                    set: function(n) {
                        this.insertAfter(n);
                    }
                },
                previous: {
                    enumerable: true,
                    configurable: true,
                    get: function() {
                        return this.prv;
                    },
                    set: function(n) {
                        this.insertBefore(n);
                    }   
                }
            },
            tree : {
                children: {
                    enumerable: true,
                    configurable: true,
                    /**
                     * @return {array} Returns an array of all children.
                     */
                    get: function() {
                        for (var z = [], i = 0, node = this.fch; i++ < this.noc;)(
                            z.push(node), node = node.nxt
                        );
                        return z;
                    },
                    set: function(e) {
                        /* No OP */
                    }
                },
                parent: {
                    enumerable: true,
                    configurable: true,
                    /**
                     * @return parent node
                     */
                    get: function() {
                        return this.par;
                    },
                    set: function(p) {
                        if(p && p.addChild)
                            p.addChild(this);
                        else if(p === null && this.par)
                            this.par.removeChild(this);
                    }
                }
            }
        },


        mixin : (constructor)=>{
            const proto = (typeof(constructor) == "function") ? constructor.prototype : (typeof(constructor) == "object") ? constructor : null;
            if(proto){
                Object.assign(proto, 
                    LinkedList.props.defaults, 
                    LinkedList.methods.defaults
                );
            }
            Object.defineProperties(proto, LinkedList.gettersAndSetters.peer);
        },

        mixinTree : (constructor)=>{
            const proto = (typeof(constructor) == "function") ? constructor.prototype : (typeof(constructor) == "object") ? constructor : null;
            if(proto){
                Object.assign(proto, 
                    LinkedList.props.defaults, 
                    LinkedList.props.children, 
                    LinkedList.props.parent, 
                    LinkedList.methods.defaults, 
                    LinkedList.methods.parent_child
                    );
                Object.defineProperties(proto, LinkedList.gettersAndSetters.tree);
                Object.defineProperties(proto, LinkedList.gettersAndSetters.peer);
            }
        }
    };

    const HORIZONTAL_TAB = 9;
    const SPACE = 32;

    /**
     * Lexer Jump table reference 
     * 0. NUMBER
     * 1. IDENTIFIER
     * 2. QUOTE STRING
     * 3. SPACE SET
     * 4. TAB SET
     * 5. CARIAGE RETURN
     * 6. LINEFEED
     * 7. SYMBOL
     * 8. OPERATOR
     * 9. OPEN BRACKET
     * 10. CLOSE BRACKET 
     * 11. DATA_LINK
     */ 
    const jump_table = [
    7, 	 	/* A */
    7, 	 	/* a */
    7, 	 	/* ACKNOWLEDGE */
    7, 	 	/* AMPERSAND */
    7, 	 	/* ASTERISK */
    7, 	 	/* AT */
    7, 	 	/* B */
    7, 	 	/* b */
    7, 	 	/* BACKSLASH */
    4, 	 	/* BACKSPACE */
    6, 	 	/* BELL */
    7, 	 	/* C */
    7, 	 	/* c */
    5, 	 	/* CANCEL */
    7, 	 	/* CARET */
    11, 	/* CARRIAGE_RETURN */
    7, 	 	/* CLOSE_CURLY */
    7, 	 	/* CLOSE_PARENTH */
    7, 	 	/* CLOSE_SQUARE */
    7, 	 	/* COLON */
    7, 	 	/* COMMA */
    7, 	 	/* d */
    7, 	 	/* D */
    7, 	 	/* DATA_LINK_ESCAPE */
    7, 	 	/* DELETE */
    7, 	 	/* DEVICE_CTRL_1 */
    7, 	 	/* DEVICE_CTRL_2 */
    7, 	 	/* DEVICE_CTRL_3 */
    7, 	 	/* DEVICE_CTRL_4 */
    7, 	 	/* DOLLAR */
    7, 	 	/* DOUBLE_QUOTE */
    7, 	 	/* e */
    3, 	 	/* E */
    8, 	 	/* EIGHT */
    2, 	 	/* END_OF_MEDIUM */
    7, 	 	/* END_OF_TRANSMISSION */
    7, 	 	/* END_OF_TRANSMISSION_BLOCK */
    8, 	 	/* END_OF_TXT */
    8, 	 	/* ENQUIRY */
    2, 	 	/* EQUAL */
    9, 	 	/* ESCAPE */
    10, 	 /* EXCLAMATION */
    8, 	 	/* f */
    8, 	 	/* F */
    7, 	 	/* FILE_SEPERATOR */
    7, 	 	/* FIVE */
    7, 	 	/* FORM_FEED */
    7, 	 	/* FORWARD_SLASH */
    0, 	 	/* FOUR */
    0, 	 	/* g */
    0, 	 	/* G */
    0, 	 	/* GRAVE */
    0, 	 	/* GREATER_THAN */
    0, 	 	/* GROUP_SEPERATOR */
    0, 	 	/* h */
    0, 	 	/* H */
    0, 	 	/* HASH */
    0, 	 	/* HORIZONTAL_TAB */
    8, 	 	/* HYPHEN */
    7, 	 	/* i */
    8, 	 	/* I */
    8, 	 	/* j */
    8, 	 	/* J */
    7, 	 	/* k */
    7, 	 	/* K */
    1, 	 	/* l */
    1, 	 	/* L */
    1, 	 	/* LESS_THAN */
    1, 	 	/* LINE_FEED */
    1, 	 	/* m */
    1, 	 	/* M */
    1, 	 	/* n */
    1, 	 	/* N */
    1, 	 	/* NEGATIVE_ACKNOWLEDGE */
    1, 	 	/* NINE */
    1, 	 	/* NULL */
    1, 	 	/* o */
    1, 	 	/* O */
    1, 	 	/* ONE */
    1, 	 	/* OPEN_CURLY */
    1, 	 	/* OPEN_PARENTH */
    1, 	 	/* OPEN_SQUARE */
    1, 	 	/* p */
    1, 	 	/* P */
    1, 	 	/* PERCENT */
    1, 	 	/* PERIOD */
    1, 	 	/* PLUS */
    1, 	 	/* q */
    1, 	 	/* Q */
    1, 	 	/* QMARK */
    1, 	 	/* QUOTE */
    9, 	 	/* r */
    7, 	 	/* R */
    10, 	/* RECORD_SEPERATOR */
    7, 	 	/* s */
    7, 	 	/* S */
    2, 	 	/* SEMICOLON */
    1, 	 	/* SEVEN */
    1, 	 	/* SHIFT_IN */
    1, 	 	/* SHIFT_OUT */
    1, 	 	/* SIX */
    1, 	 	/* SPACE */
    1, 	 	/* START_OF_HEADER */
    1, 	 	/* START_OF_TEXT */
    1, 	 	/* SUBSTITUTE */
    1, 	 	/* SYNCH_IDLE */
    1, 	 	/* t */
    1, 	 	/* T */
    1, 	 	/* THREE */
    1, 	 	/* TILDE */
    1, 	 	/* TWO */
    1, 	 	/* u */
    1, 	 	/* U */
    1, 	 	/* UNDER_SCORE */
    1, 	 	/* UNIT_SEPERATOR */
    1, 	 	/* v */
    1, 	 	/* V */
    1, 	 	/* VERTICAL_BAR */
    1, 	 	/* VERTICAL_TAB */
    1, 	 	/* w */
    1, 	 	/* W */
    1, 	 	/* x */
    1, 	 	/* X */
    9, 	 	/* y */
    7, 	 	/* Y */
    10,  	/* z */
    7,  	/* Z */
    7 		/* ZERO */
    ];	

    /**
     * LExer Number and Identifier jump table reference
     * Number are masked by 12(4|8) and Identifiers are masked by 10(2|8)
     * entries marked as `0` are not evaluated as either being in the number set or the identifier set.
     * entries marked as `2` are in the identifier set but not the number set
     * entries marked as `4` are in the number set but not the identifier set
     * entries marked as `8` are in both number and identifier sets
     */
    const number_and_identifier_table = [
    0, 		/* A */
    0, 		/* a */
    0, 		/* ACKNOWLEDGE */
    0, 		/* AMPERSAND */
    0, 		/* ASTERISK */
    0, 		/* AT */
    0,		/* B */
    0,		/* b */
    0,		/* BACKSLASH */
    0,		/* BACKSPACE */
    0,		/* BELL */
    0,		/* C */
    0,		/* c */
    0,		/* CANCEL */
    0,		/* CARET */
    0,		/* CARRIAGE_RETURN */
    0,		/* CLOSE_CURLY */
    0,		/* CLOSE_PARENTH */
    0,		/* CLOSE_SQUARE */
    0,		/* COLON */
    0,		/* COMMA */
    0,		/* d */
    0,		/* D */
    0,		/* DATA_LINK_ESCAPE */
    0,		/* DELETE */
    0,		/* DEVICE_CTRL_1 */
    0,		/* DEVICE_CTRL_2 */
    0,		/* DEVICE_CTRL_3 */
    0,		/* DEVICE_CTRL_4 */
    0,		/* DOLLAR */
    0,		/* DOUBLE_QUOTE */
    0,		/* e */
    0,		/* E */
    0,		/* EIGHT */
    0,		/* END_OF_MEDIUM */
    0,		/* END_OF_TRANSMISSION */
    8,		/* END_OF_TRANSMISSION_BLOCK */
    0,		/* END_OF_TXT */
    0,		/* ENQUIRY */
    0,		/* EQUAL */
    0,		/* ESCAPE */
    0,		/* EXCLAMATION */
    0,		/* f */
    0,		/* F */
    0,		/* FILE_SEPERATOR */
    2,		/* FIVE */
    4,		/* FORM_FEED */
    0,		/* FORWARD_SLASH */
    8,		/* FOUR */
    8,		/* g */
    8,		/* G */
    8,		/* GRAVE */
    8,		/* GREATER_THAN */
    8,		/* GROUP_SEPERATOR */
    8,		/* h */
    8,		/* H */
    8,		/* HASH */
    8,		/* HORIZONTAL_TAB */
    0,		/* HYPHEN */
    0,		/* i */
    0,		/* I */
    0,		/* j */
    0,		/* J */
    0,		/* k */
    0,		/* K */
    2,		/* l */
    8,		/* L */
    2,		/* LESS_THAN */
    2,		/* LINE_FEED */
    8,		/* m */
    2,		/* M */
    2,		/* n */
    2,		/* N */
    2,		/* NEGATIVE_ACKNOWLEDGE */
    2,		/* NINE */
    2,		/* NULL */
    2,		/* o */
    2,		/* O */
    2,		/* ONE */
    8,		/* OPEN_CURLY */
    2,		/* OPEN_PARENTH */
    2,		/* OPEN_SQUARE */
    2,		/* p */
    2,		/* P */
    2,		/* PERCENT */
    2,		/* PERIOD */
    2,		/* PLUS */
    2,		/* q */
    8,		/* Q */
    2,		/* QMARK */
    2,		/* QUOTE */
    0,		/* r */
    0,		/* R */
    0,		/* RECORD_SEPERATOR */
    0,		/* s */
    2,		/* S */
    0,		/* SEMICOLON */
    2,		/* SEVEN */
    8,		/* SHIFT_IN */
    2,		/* SHIFT_OUT */
    2,		/* SIX */
    2,		/* SPACE */
    2,		/* START_OF_HEADER */
    2,		/* START_OF_TEXT */
    2,		/* SUBSTITUTE */
    2,		/* SYNCH_IDLE */
    2,		/* t */
    2,		/* T */
    2,		/* THREE */
    2,		/* TILDE */
    2,		/* TWO */
    8,		/* u */
    2,		/* U */
    2,		/* UNDER_SCORE */
    2,		/* UNIT_SEPERATOR */
    2,		/* v */
    2,		/* V */
    2,		/* VERTICAL_BAR */
    2,		/* VERTICAL_TAB */
    2,		/* w */
    8,		/* W */
    2,		/* x */
    2,		/* X */
    0,		/* y */
    0,		/* Y */
    0,		/* z */
    0,		/* Z */
    0		/* ZERO */
    ];

    const number = 1,
        identifier = 2,
        string = 4,
        white_space = 8,
        open_bracket = 16,
        close_bracket = 32,
        operator = 64,
        symbol = 128,
        new_line = 256,
        data_link = 512,
        alpha_numeric = (identifier | number),
        white_space_new_line = (white_space | new_line),
        Types = {
            num: number,
            number,
            id: identifier,
            identifier,
            str: string,
            string,
            ws: white_space,
            white_space,
            ob: open_bracket,
            open_bracket,
            cb: close_bracket,
            close_bracket,
            op: operator,
            operator,
            sym: symbol,
            symbol,
            nl: new_line,
            new_line,
            dl: data_link,
            data_link,
            alpha_numeric,
            white_space_new_line,
        },

        /*** MASKS ***/

        TYPE_MASK = 0xF,
        PARSE_STRING_MASK = 0x10,
        IGNORE_WHITESPACE_MASK = 0x20,
        CHARACTERS_ONLY_MASK = 0x40,
        TOKEN_LENGTH_MASK = 0xFFFFFF80,

        //De Bruijn Sequence for finding index of right most bit set.
        //http://supertech.csail.mit.edu/papers/debruijn.pdf
        debruijnLUT = [
            0, 1, 28, 2, 29, 14, 24, 3, 30, 22, 20, 15, 25, 17, 4, 8,
            31, 27, 13, 23, 21, 19, 16, 7, 26, 12, 18, 6, 11, 5, 10, 9
        ];

    function getNumbrOfTrailingZeroBitsFromPowerOf2(value) {
        return debruijnLUT[(value * 0x077CB531) >>> 27];
    }

    class Lexer {

        constructor(string = "", INCLUDE_WHITE_SPACE_TOKENS = false, PEEKING = false) {

            if (typeof(string) !== "string") throw new Error(`String value must be passed to Lexer. A ${typeof(string)} was passed as the \`string\` argument.`);

            /**
             * The string that the Lexer tokenizes.
             */
            this.str = string;

            /**
             * Reference to the peeking Lexer.
             */
            this.p = null;

            /**
             * The type id of the current token.
             */
            this.type = 32768; //Default "non-value" for types is 1<<15;

            /**
             * The offset in the string of the start of the current token.
             */
            this.off = 0;

            this.masked_values = 0;

            /**
             * The character offset of the current token within a line.
             */
            this.char = 0;
            /**
             * The line position of the current token.
             */
            this.line = 0;
            /**
             * The length of the string being parsed
             */
            this.sl = string.length;
            /**
             * The length of the current token.
             */
            this.tl = 0;

            /**
             * Flag to ignore white spaced.
             */
            this.IWS = !INCLUDE_WHITE_SPACE_TOKENS;

            /**
             * Flag to force the lexer to parse string contents
             */
            this.PARSE_STRING = false;

            if (!PEEKING) this.next();
        }

        /**
         * Restricts max parse distance to the other Lexer's current position.
         * @param      {Lexer}  Lexer   The Lexer to limit parse distance by.
         */
        fence(marker = this) {
            if (marker.str !== this.str)
                return;
            this.sl = marker.off;
            return this;
        }

        /**
         * Copies the Lexer.
         * @return     {Lexer}  Returns a new Lexer instance with the same property values.
         */
        copy(destination = new Lexer(this.str, false, true)) {
            destination.off = this.off;
            destination.char = this.char;
            destination.line = this.line;
            destination.sl = this.sl;
            destination.masked_values = this.masked_values;
            return destination;
        }

        /**
         * Given another Lexer with the same `str` property value, it will copy the state of that Lexer.
         * @param      {Lexer}  [marker=this.peek]  The Lexer to clone the state from. 
         * @throws     {Error} Throws an error if the Lexers reference different strings.
         * @public
         */
        sync(marker = this.p) {

            if (marker instanceof Lexer) {
                if (marker.str !== this.str) throw new Error("Cannot sync Lexers with different strings!");
                this.off = marker.off;
                this.char = marker.char;
                this.line = marker.line;
                this.masked_values = marker.masked_values;
            }

            return this;
        }

        /**
        Creates and error message with a diagrame illustrating the location of the error. 
        */
        errorMessage(message = "") {
            const arrow = String.fromCharCode(0x2b89),
                trs = String.fromCharCode(0x2500),
                line = String.fromCharCode(0x2500),
                thick_line = String.fromCharCode(0x2501),
                line_number = "    " + this.line + ": ",
                line_fill = line_number.length,
                t$$1 = thick_line.repeat(line_fill + 48),
                is_iws = (!this.IWS) ? "\n The Lexer produced whitespace tokens" : "";
            const pk = this.copy();
            pk.IWS = false;
            while (!pk.END && pk.ty !== Types.nl) { pk.next(); }
            const end = pk.off;

            return `${message} at ${this.line}:${this.char}
${t$$1}
${line_number+this.str.slice(Math.max(this.off - this.char, 0), end)}
${line.repeat(this.char-1+line_fill)+trs+arrow}
${t$$1}
${is_iws}`;
        }

        /**
         * Will throw a new Error, appending the parsed string line and position information to the the error message passed into the function.
         * @instance
         * @public
         * @param {String} message - The error message.
         * @param {Bool} DEFER - if true, returns an Error object instead of throwing.
         */
        throw (message, DEFER = false) {
            const error = new Error(this.errorMessage(message));
            if (DEFER)
                return error;
            throw error;
        }

        /**
         * Proxy for Lexer.prototype.reset
         * @public
         */
        r() { return this.reset() }

        /**
         * Restore the Lexer back to it's initial state.
         * @public
         */
        reset() {
            this.p = null;
            this.type = 32768;
            this.off = 0;
            this.tl = 0;
            this.char = 0;
            this.line = 0;
            this.n;
            return this;
        }

        resetHead() {
            this.off = 0;
            this.tl = 0;
            this.char = 0;
            this.line = 0;
            this.p = null;
            this.type = 32768;
        }

        /**
         * Sets the internal state to point to the next token. Sets Lexer.prototype.END to `true` if the end of the string is hit.
         * @public
         * @param {Lexer} [marker=this] - If another Lexer is passed into this method, it will advance the token state of that Lexer.
         */
        next(marker = this) {

            if (marker.sl < 1) {
                marker.off = 0;
                marker.type = 32768;
                marker.tl = 0;
                marker.line = 0;
                marker.char = 0;
                return marker;
            }

            //Token builder
            const l$$1 = marker.sl,
                str = marker.str,
                IWS = marker.IWS;

            let length = marker.tl,
                off = marker.off + length,
                type = symbol,
                char = marker.char + length,
                line = marker.line,
                base = off;

            if (off >= l$$1) {
                length = 0;
                base = l$$1;
                char -= base - off;
                marker.type = type;
                marker.off = base;
                marker.tl = length;
                marker.char = char;
                marker.line = line;
                return marker;
            }

            const USE_CUSTOM_SYMBOLS = !!this.symbol_map;
            let NORMAL_PARSE = true;

            if (USE_CUSTOM_SYMBOLS) {

                let code = str.charCodeAt(off);
                let off2 = off;
                let map = this.symbol_map,
                    m$$1;

                while(code == 32 && IWS)
                    (code = str.charCodeAt(++off2), off++);

                while ((m$$1 = map.get(code))) {
                    map = m$$1;
                    off2 += 1;
                    code = str.charCodeAt(off2);
                }

                if (map.IS_SYM) {
                   NORMAL_PARSE = false;
                   base = off;
                   length = off2 - off;
                   char += length;
                }
            }

            if (NORMAL_PARSE) {


                for (;;) {

                    base = off;

                    length = 1;

                    const code = str.charCodeAt(off);

                    if (code < 128) {

                        switch (jump_table[code]) {
                            case 0: //NUMBER
                                while (++off < l$$1 && (12 & number_and_identifier_table[str.charCodeAt(off)]));

                                if ((str[off] == "e" || str[off] == "E") && (12 & number_and_identifier_table[str.charCodeAt(off+1)])) {
                                    off++;
                                    if (str[off] == "-") off++;
                                    marker.off = off;
                                    marker.tl = 0;
                                    marker.next();
                                    off = marker.off + marker.tl;
                                    //Add e to the number string
                                }

                                type = number;
                                length = off - base;

                                break;
                            case 1: //IDENTIFIER
                                while (++off < l$$1 && ((10 & number_and_identifier_table[str.charCodeAt(off)])));
                                type = identifier;
                                length = off - base;
                                break;
                            case 2: //QUOTED STRING
                                if (this.PARSE_STRING) {
                                    type = symbol;
                                } else {
                                    while (++off < l$$1 && str.charCodeAt(off) !== code);
                                    type = string;
                                    length = off - base + 1;
                                }
                                break;
                            case 3: //SPACE SET
                                while (++off < l$$1 && str.charCodeAt(off) === SPACE);
                                type = white_space;
                                length = off - base;
                                break;
                            case 4: //TAB SET
                                while (++off < l$$1 && str[off] === HORIZONTAL_TAB);
                                type = white_space;
                                length = off - base;
                                break;
                            case 5: //CARIAGE RETURN
                                length = 2;
                                //Intentional
                            case 6: //LINEFEED
                                type = new_line;
                                char = 0;
                                line++;
                                off += length;
                                break;
                            case 7: //SYMBOL
                                type = symbol;
                                break;
                            case 8: //OPERATOR
                                type = operator;
                                break;
                            case 9: //OPEN BRACKET
                                type = open_bracket;
                                break;
                            case 10: //CLOSE BRACKET
                                type = close_bracket;
                                break;
                            case 11: //Data Link Escape
                                type = data_link;
                                length = 4; //Stores two UTF16 values and a data link sentinel
                                break;
                        }
                    }

                    if (IWS && (type & white_space_new_line)) {
                        if (off < l$$1) {
                            char += length;
                            type = symbol;
                            continue;
                        } else {
                            //Trim white space from end of string
                            base = l$$1 - length;
                            marker.sl -= length;
                            length = 0;
                            char -= base - off;
                        }
                    }

                    break;
                }
            }

            marker.type = type;
            marker.off = base;
            marker.tl = (this.masked_values & CHARACTERS_ONLY_MASK) ? Math.min(1, length) : length;
            marker.char = char;
            marker.line = line;

            return marker;
        }


        /**
         * Proxy for Lexer.prototype.assert
         * @public
         */
        a(text) {
            return this.assert(text);
        }

        /**
         * Compares the string value of the current token to the value passed in. Advances to next token if the two are equal.
         * @public
         * @throws {Error} - `Expecting "${text}" got "${this.text}"`
         * @param {String} text - The string to compare.
         */
        assert(text) {

            if (this.off < 0) this.throw(`Expecting ${text} got null`);

            if (this.text == text)
                this.next();
            else
                this.throw(`Expecting "${text}" got "${this.text}"`);

            return this;
        }

        /**
         * Proxy for Lexer.prototype.assertCharacter
         * @public
         */
        aC(char) { return this.assertCharacter(char) }
        /**
         * Compares the character value of the current token to the value passed in. Advances to next token if the two are equal.
         * @public
         * @throws {Error} - `Expecting "${text}" got "${this.text}"`
         * @param {String} text - The string to compare.
         */
        assertCharacter(char) {

            if (this.off < 0) this.throw(`Expecting ${char[0]} got null`);

            if (this.ch == char[0])
                this.next();
            else
                this.throw(`Expecting "${char[0]}" got "${this.tx[this.off]}"`);

            return this;
        }

        /**
         * Returns the Lexer bound to Lexer.prototype.p, or creates and binds a new Lexer to Lexer.prototype.p. Advences the other Lexer to the token ahead of the calling Lexer.
         * @public
         * @type {Lexer}
         * @param {Lexer} [marker=this] - The marker to originate the peek from. 
         * @param {Lexer} [peek_marker=this.p] - The Lexer to set to the next token state.
         * @return {Lexer} - The Lexer that contains the peeked at token.
         */
        peek(marker = this, peek_marker = this.p) {

            if (!peek_marker) {
                if (!marker) return null;
                if (!this.p) {
                    this.p = new Lexer(this.str, false, true);
                    peek_marker = this.p;
                }
            }
            peek_marker.masked_values = marker.masked_values;
            peek_marker.type = marker.type;
            peek_marker.off = marker.off;
            peek_marker.tl = marker.tl;
            peek_marker.char = marker.char;
            peek_marker.line = marker.line;
            this.next(peek_marker);
            return peek_marker;
        }


        /**
         * Proxy for Lexer.prototype.slice
         * @public
         */
        s(start) { return this.slice(start) }

        /**
         * Returns a slice of the parsed string beginning at `start` and ending at the current token.
         * @param {Number | LexerBeta} start - The offset in this.str to begin the slice. If this value is a LexerBeta, sets the start point to the value of start.off.
         * @return {String} A substring of the parsed string.
         * @public
         */
        slice(start = this.off) {

            if (start instanceof Lexer) start = start.off;

            return this.str.slice(start, (this.off <= start) ? this.sl : this.off);
        }

        /**
         * Skips to the end of a comment section.
         * @param {boolean} ASSERT - If set to true, will through an error if there is not a comment line or block to skip.
         * @param {Lexer} [marker=this] - If another Lexer is passed into this method, it will advance the token state of that Lexer.
         */
        comment(ASSERT = false, marker = this) {

            if (!(marker instanceof Lexer)) return marker;

            if (marker.ch == "/") {
                if (marker.pk.ch == "*") {
                    marker.sync();
                    while (!marker.END && (marker.next().ch != "*" || marker.pk.ch != "/")) { /* NO OP */ }
                    marker.sync().assert("/");
                } else if (marker.pk.ch == "/") {
                    const IWS = marker.IWS;
                    while (marker.next().ty != Types.new_line && !marker.END) { /* NO OP */ }
                    marker.IWS = IWS;
                    marker.next();
                } else
                if (ASSERT) marker.throw("Expecting the start of a comment");
            }

            return marker;
        }

        setString(string, RESET = true) {
            this.str = string;
            this.sl = string.length;
            if (RESET) this.resetHead();
        }

        toString() {
            return this.slice();
        }

        /**
         * Returns new Whind Lexer that has leading and trailing whitespace characters removed from input. 
         */
        trim() {
            const lex = this.copy();

            for (; lex.off < lex.sl; lex.off++) {
                const c$$1 = jump_table[lex.string.charCodeAt(lex.off)];

                if (c$$1 > 2 && c$$1 < 7)
                    continue;

                break;
            }

            for (; lex.sl > lex.off; lex.sl--) {
                const c$$1 = jump_table[lex.string.charCodeAt(lex.sl - 1)];

                if (c$$1 > 2 && c$$1 < 7)
                    continue;

                break;
            }

            lex.token_length = 0;
            lex.next();

            return lex;
        }

        /** Adds symbol to symbol_map. This allows custom symbols to be defined and tokenized by parser. **/
        addSymbol(sym) {
            if (!this.symbol_map)
                this.symbol_map = new Map;


            let map = this.symbol_map;

            for (let i$$1 = 0; i$$1 < sym.length; i$$1++) {
                let code = sym.charCodeAt(i$$1);
                let m$$1 = map.get(code);
                if (!m$$1){
                    m$$1 = map.set(code, new Map).get(code);
                }
                map = m$$1;
            }
            map.IS_SYM = true;
        }

        /*** Getters and Setters ***/
        get string() {
            return this.str;
        }

        get string_length() {
            return this.sl - this.off;
        }

        set string_length(s$$1) {}

        /**
         * The current token in the form of a new Lexer with the current state.
         * Proxy property for Lexer.prototype.copy
         * @type {Lexer}
         * @public
         * @readonly
         */
        get token() {
            return this.copy();
        }


        get ch() {
            return this.str[this.off];
        }

        /**
         * Proxy for Lexer.prototype.text
         * @public
         * @type {String}
         * @readonly
         */
        get tx() { return this.text }

        /**
         * The string value of the current token.
         * @type {String}
         * @public
         * @readonly
         */
        get text() {
            return (this.off < 0) ? "" : this.str.slice(this.off, this.off + this.tl);
        }

        /**
         * The type id of the current token.
         * @type {Number}
         * @public
         * @readonly
         */
        get ty() { return this.type }

        /**
         * The current token's offset position from the start of the string.
         * @type {Number}
         * @public
         * @readonly
         */
        get pos() {
            return this.off;
        }

        /**
         * Proxy for Lexer.prototype.peek
         * @public
         * @readonly
         * @type {Lexer}
         */
        get pk() { return this.peek() }

        /**
         * Proxy for Lexer.prototype.next
         * @public
         */
        get n() { return this.next() }

        get END() { return this.off >= this.sl }
        set END(v$$1) {}

        get type() {
            return 1 << (this.masked_values & TYPE_MASK);
        }

        set type(value) {
            //assuming power of 2 value.
            this.masked_values = (this.masked_values & ~TYPE_MASK) | ((getNumbrOfTrailingZeroBitsFromPowerOf2(value)) & TYPE_MASK);
        }

        get tl() {
            return this.token_length;
        }

        set tl(value) {
            this.token_length = value;
        }

        get token_length() {
            return ((this.masked_values & TOKEN_LENGTH_MASK) >> 7);
        }

        set token_length(value) {
            this.masked_values = (this.masked_values & ~TOKEN_LENGTH_MASK) | (((value << 7) | 0) & TOKEN_LENGTH_MASK);
        }

        get IGNORE_WHITE_SPACE() {
            return this.IWS;
        }

        set IGNORE_WHITE_SPACE(bool) {
            this.iws = !!bool;
        }

        get CHARACTERS_ONLY() {
            return !!(this.masked_values & CHARACTERS_ONLY_MASK);
        }

        set CHARACTERS_ONLY(boolean) {
            this.masked_values = (this.masked_values & ~CHARACTERS_ONLY_MASK) | ((boolean | 0) << 6);
        }

        get IWS() {
            return !!(this.masked_values & IGNORE_WHITESPACE_MASK);
        }

        set IWS(boolean) {
            this.masked_values = (this.masked_values & ~IGNORE_WHITESPACE_MASK) | ((boolean | 0) << 5);
        }

        get PARSE_STRING() {
            return !!(this.masked_values & PARSE_STRING_MASK);
        }

        set PARSE_STRING(boolean) {
            this.masked_values = (this.masked_values & ~PARSE_STRING_MASK) | ((boolean | 0) << 4);
        }

        /**
         * Reference to token id types.
         */
        get types() {
            return Types;
        }
    }

    function whind$1(string, INCLUDE_WHITE_SPACE_TOKENS = false) { return new Lexer(string, INCLUDE_WHITE_SPACE_TOKENS) }

    whind$1.constructor = Lexer;

    Lexer.types = Types;
    whind$1.types = Types;

    /**
     * Holds a set of rendered CSS properties.
     * @memberof module:wick~internals.css
     * @alias CSSRule
     */
    class CSSRule {
        constructor(root) {
            /**
             * Collection of properties held by this rule.
             * @public
             */
            this.props = {};
            this.LOADED = false;
            this.root = root;

            //Reference Counting
            this.refs = 0;

            //Versioning
            this.ver = 0;
        }

        incrementRef(){
            this.refs++;
        }

        decrementRef(){
            this.refs--;
            if(this.refs <= 0){
                //TODO: remove from rules entries.
                debugger
            }
        }

        addProperty(prop, rule) {
            if (prop)
                this.props[prop.name] = prop.value;
        }



        toString(off = 0, rule = "") {
            let str = [],
                offset = ("    ").repeat(off);

            if (rule) {
                if (this.props[rule]) {
                    if (Array.isArray(this.props[rule]))
                        str.push(this.props[rule].join(" "));
                    else
                        str.push(this.props[rule].toString());
                }else
                    return "";
            } else {
                for (let a in this.props) {
                    if (this.props[a] !== null) {
                        if (Array.isArray(this.props[a]))
                            str.push(offset, a.replace(/\_/g, "-"), ":", this.props[a].join(" "), ";\n");
                        else
                            str.push(offset, a.replace(/\_/g, "-"), ":", this.props[a].toString(), ";\n");
                    }
                }
            }

            return str.join(""); //JSON.stringify(this.props).replace(/\"/g, "").replace(/\_/g, "-");
        }

        merge(rule) {
            if (rule.props) {
                for (let n in rule.props)
                    this.props[n] = rule.props[n];
                this.LOADED = true;
                this.ver++;
            }
        }

        get _wick_type_() { return 0; }

        set _wick_type_(v) {}
    }

    class Color extends Float64Array {

        constructor(r, g, b, a = 0) {
            super(4);

            this.r = 0;
            this.g = 0;
            this.b = 0;
            this.a = 1;

            if (typeof(r) === "number") {
                this.r = r; //Math.max(Math.min(Math.round(r),255),-255);
                this.g = g; //Math.max(Math.min(Math.round(g),255),-255);
                this.b = b; //Math.max(Math.min(Math.round(b),255),-255);
                this.a = a; //Math.max(Math.min(a,1),-1);
            }
        }

        get r() {
            return this[0];
        }

        set r(r) {
            this[0] = r;
        }

        get g() {
            return this[1];
        }

        set g(g) {
            this[1] = g;
        }

        get b() {
            return this[2];
        }

        set b(b) {
            this[2] = b;
        }

        get a() {
            return this[3];
        }

        set a(a) {
            this[3] = a;
        }

        set(color) {
            this.r = color.r;
            this.g = color.g;
            this.b = color.b;
            this.a = (color.a != undefined) ? color.a : this.a;
        }

        add(color) {
            return new Color(
                color.r + this.r,
                color.g + this.g,
                color.b + this.b,
                color.a + this.a
            );
        }

        mult(color) {
            if (typeof(color) == "number") {
                return new Color(
                    this.r * color,
                    this.g * color,
                    this.b * color,
                    this.a * color
                );
            } else {
                return new Color(
                    this.r * color.r,
                    this.g * color.g,
                    this.b * color.b,
                    this.a * color.a
                );
            }
        }

        sub(color) {
            return new Color(
                this.r - color.r,
                this.g - color.g,
                this.b - color.b,
                this.a - color.a
            );
        }

        lerp(to, t){
            return this.add(to.sub(this).mult(t));
        }

        toString() {
            return `rgba(${this.r|0},${this.g|0},${this.b|0},${this.a})`;
        }

        toJSON() {
            return `rgba(${this.r|0},${this.g|0},${this.b|0},${this.a})`;
        }

        copy(other){
            let out = new Color(other);
            return out;
        }
    }

    /*
        BODY {color: black; background: white }
        H1 { color: maroon }
        H2 { color: olive }
        EM { color: #f00 }              // #rgb //
        EM { color: #ff0000 }           // #rrggbb //
        EM { color: rgb(255,0,0) }      // integer range 0 - 255 //
        EM { color: rgb(100%, 0%, 0%) } // float range 0.0% - 100.0% //
    */
    class CSS_Color extends Color {

        /** UI FUNCTIONS **/

        static list(){}

        static valueHandler(existing_value){
            let ele = document.createElement("input");
            ele.type = "color";
            ele.value = (existing_value) ? existing_value+ "" : "#000000";
            ele.addEventListener("change", (e)=>{
                ele.css_value = ele.value;
            });
            return ele;
        }

        static setInput(input, value){
            input.type = "color";
            input.value = value;
        }

        static buildInput(){
            let ele = document.createElement("input");
            ele.type = "color";
            return ele;
        }

        static parse(l, rule, r) {

            let c = CSS_Color._fs_(l);

            if (c) {

                let color = new CSS_Color();

                color.set(c);

                return color;
            }

            return null;
        }
        static _verify_(l) {
            let c = CSS_Color._fs_(l, true);
            if (c)
                return true;
            return false;
        }
        /**
            Creates a new Color from a string or a Lexer.
        */
        static _fs_(l, v = false) {
            let c;

            if (typeof(l) == "string")
                l = whind$1(l);

            let out = { r: 0, g: 0, b: 0, a: 1 };

            switch (l.ch) {
                case "#":
                    l.next();
                    let pk = l.copy();

                    let type = l.types;
                    pk.IWS = false;


                    while(!(pk.ty & (type.newline | type.ws)) && !pk.END && pk.ch !== ";"){
                        pk.next();
                    }

                    var value = pk.slice(l);
                    l.sync(pk);
                    l.tl = 0;
                    l.next();
                    
                    let num = parseInt(value,16);

                    if(value.length == 3 || value.length == 4){
                        
                        if(value.length == 4){
                            const a = (num >> 8) & 0xF;
                            out.a = a | a << 4;
                            num >>= 4;
                        }

                        const r = (num >> 8) & 0xF;
                        out.r = r | r << 4;
                        
                        const g = (num >> 4) & 0xF;
                        out.g = g | g << 4;
                        
                        const b = (num) & 0xF;
                        out.b = b | b << 4;

                    }else{

                        if(value.length == 8){
                            out.a = num & 0xFF;
                            num >>= 8;
                        }

                        out.r = (num >> 16) & 0xFF;       
                        out.g = (num >> 8) & 0xFF;
                        out.b = (num) & 0xFF;
                    }
                    l.next();
                    break;
                case "r":
                    let tx = l.tx;

                    const RGB_TYPE = tx === "rgba"  ? 1 : tx === "rgb" ? 2 : 0;
                    
                    if(RGB_TYPE > 0){

                        l.next(); // (
                        
                        out.r = parseInt(l.next().tx);
                        
                        l.next(); // , or  %

                        if(l.ch == "%"){
                            l.next(); out.r = out.r * 255 / 100;
                        }
                        
                        
                        out.g = parseInt(l.next().tx);
                        
                        l.next(); // , or  %
                       
                        if(l.ch == "%"){
                            l.next(); out.g = out.g * 255 / 100;
                        }
                        
                        
                        out.b = parseInt(l.next().tx);
                        
                        l.next(); // , or ) or %
                        
                        if(l.ch == "%")
                            l.next(), out.b = out.b * 255 / 100;

                        if(RGB_TYPE < 2){
                            out.a = parseFloat(l.next().tx);

                            l.next();
                            
                            if(l.ch == "%")
                                l.next(), out.a = out.a * 255 / 100;
                        }

                        l.a(")");
                        c = new CSS_Color();
                        c.set(out);
                        return c;
                    }  // intentional
                default:

                    let string = l.tx;

                    if (l.ty == l.types.str){
                        string = string.slice(1, -1);
                    }

                    out = CSS_Color.colors[string.toLowerCase()];

                    if(out)
                        l.next();
            }

            return out;
        }

        constructor(r, g, b, a) {
            super(r, g, b, a);

            if (typeof(r) == "string")
                this.set(CSS_Color._fs_(r) || {r:255,g:255,b:255,a:0});

        }

        toString(){
            return `#${("0"+this.r.toString(16)).slice(-2)}${("0"+this.g.toString(16)).slice(-2)}${("0"+this.b.toString(16)).slice(-2)}`
        }
        toRGBString(){
            return `rgba(${this.r.toString()},${this.g.toString()},${this.b.toString()},${this.a.toString()})`   
        }
    } {

        let _$ = (r = 0, g = 0, b = 0, a = 1) => ({ r, g, b, a });
        let c = _$(0, 255, 25);
        CSS_Color.colors = {
            "alice blue": _$(240, 248, 255),
            "antique white": _$(250, 235, 215),
            "aqua marine": _$(127, 255, 212),
            "aqua": c,
            "azure": _$(240, 255, 255),
            "beige": _$(245, 245, 220),
            "bisque": _$(255, 228, 196),
            "black": _$(),
            "blanched almond": _$(255, 235, 205),
            "blue violet": _$(138, 43, 226),
            "blue": _$(0, 0, 255),
            "brown": _$(165, 42, 42),
            "burly wood": _$(222, 184, 135),
            "cadet blue": _$(95, 158, 160),
            "chart reuse": _$(127, 255),
            "chocolate": _$(210, 105, 30),
            "clear": _$(255, 255, 255),
            "coral": _$(255, 127, 80),
            "corn flower blue": _$(100, 149, 237),
            "corn silk": _$(255, 248, 220),
            "crimson": _$(220, 20, 60),
            "cyan": c,
            "dark blue": _$(0, 0, 139),
            "dark cyan": _$(0, 139, 139),
            "dark golden rod": _$(184, 134, 11),
            "dark gray": _$(169, 169, 169),
            "dark green": _$(0, 100),
            "dark khaki": _$(189, 183, 107),
            "dark magenta": _$(139, 0, 139),
            "dark olive green": _$(85, 107, 47),
            "dark orange": _$(255, 140),
            "dark orchid": _$(153, 50, 204),
            "dark red": _$(139),
            "dark salmon": _$(233, 150, 122),
            "dark sea green": _$(143, 188, 143),
            "dark slate blue": _$(72, 61, 139),
            "dark slate gray": _$(47, 79, 79),
            "dark turquoise": _$(0, 206, 209),
            "dark violet": _$(148, 0, 211),
            "deep pink": _$(255, 20, 147),
            "deep sky blue": _$(0, 191, 255),
            "dim gray": _$(105, 105, 105),
            "dodger blue": _$(30, 144, 255),
            "firebrick": _$(178, 34, 34),
            "floral white": _$(255, 250, 240),
            "forest green": _$(34, 139, 34),
            "fuchsia": _$(255, 0, 255),
            "gainsboro": _$(220, 220, 220),
            "ghost white": _$(248, 248, 255),
            "gold": _$(255, 215),
            "golden rod": _$(218, 165, 32),
            "gray": _$(128, 128, 128),
            "green yellow": _$(173, 255, 47),
            "green": _$(0, 128),
            "honeydew": _$(240, 255, 240),
            "hot pink": _$(255, 105, 180),
            "indian red": _$(205, 92, 92),
            "indigo": _$(75, 0, 130),
            "ivory": _$(255, 255, 240),
            "khaki": _$(240, 230, 140),
            "lavender blush": _$(255, 240, 245),
            "lavender": _$(230, 230, 250),
            "lawn green": _$(124, 252),
            "lemon chiffon": _$(255, 250, 205),
            "light blue": _$(173, 216, 230),
            "light coral": _$(240, 128, 128),
            "light cyan": _$(224, 255, 255),
            "light golden rod yellow": _$(250, 250, 210),
            "light gray": _$(211, 211, 211),
            "light green": _$(144, 238, 144),
            "light pink": _$(255, 182, 193),
            "light salmon": _$(255, 160, 122),
            "light sea green": _$(32, 178, 170),
            "light sky blue": _$(135, 206, 250),
            "light slate gray": _$(119, 136, 153),
            "light steel blue": _$(176, 196, 222),
            "light yellow": _$(255, 255, 224),
            "lime green": _$(50, 205, 50),
            "lime": _$(0, 255),
            "lime": _$(0, 255),
            "linen": _$(250, 240, 230),
            "magenta": _$(255, 0, 255),
            "maroon": _$(128),
            "medium aqua marine": _$(102, 205, 170),
            "medium blue": _$(0, 0, 205),
            "medium orchid": _$(186, 85, 211),
            "medium purple": _$(147, 112, 219),
            "medium sea green": _$(60, 179, 113),
            "medium slate blue": _$(123, 104, 238),
            "medium spring green": _$(0, 250, 154),
            "medium turquoise": _$(72, 209, 204),
            "medium violet red": _$(199, 21, 133),
            "midnight blue": _$(25, 25, 112),
            "mint cream": _$(245, 255, 250),
            "misty rose": _$(255, 228, 225),
            "moccasin": _$(255, 228, 181),
            "navajo white": _$(255, 222, 173),
            "navy": _$(0, 0, 128),
            "old lace": _$(253, 245, 230),
            "olive drab": _$(107, 142, 35),
            "olive": _$(128, 128),
            "orange red": _$(255, 69),
            "orange": _$(255, 165),
            "orchid": _$(218, 112, 214),
            "pale golden rod": _$(238, 232, 170),
            "pale green": _$(152, 251, 152),
            "pale turquoise": _$(175, 238, 238),
            "pale violet red": _$(219, 112, 147),
            "papaya whip": _$(255, 239, 213),
            "peach puff": _$(255, 218, 185),
            "peru": _$(205, 133, 63),
            "pink": _$(255, 192, 203),
            "plum": _$(221, 160, 221),
            "powder blue": _$(176, 224, 230),
            "purple": _$(128, 0, 128),
            "red": _$(255),
            "rosy brown": _$(188, 143, 143),
            "royal blue": _$(65, 105, 225),
            "saddle brown": _$(139, 69, 19),
            "salmon": _$(250, 128, 114),
            "sandy brown": _$(244, 164, 96),
            "sea green": _$(46, 139, 87),
            "sea shell": _$(255, 245, 238),
            "sienna": _$(160, 82, 45),
            "silver": _$(192, 192, 192),
            "sky blue": _$(135, 206, 235),
            "slate blue": _$(106, 90, 205),
            "slate gray": _$(112, 128, 144),
            "snow": _$(255, 250, 250),
            "spring green": _$(0, 255, 127),
            "steel blue": _$(70, 130, 180),
            "tan": _$(210, 180, 140),
            "teal": _$(0, 128, 128),
            "thistle": _$(216, 191, 216),
            "tomato": _$(255, 99, 71),
            "transparent": _$(0, 0, 0, 0),
            "turquoise": _$(64, 224, 208),
            "violet": _$(238, 130, 238),
            "wheat": _$(245, 222, 179),
            "white smoke": _$(245, 245, 245),
            "white": _$(255, 255, 255),
            "yellow green": _$(154, 205, 50),
            "yellow": _$(255, 255)
        };
    }

    class CSS_Percentage extends Number {
        static setInput(input, value){
            input.type = "number";
            input.value = parseFloat(value);
        }

        static buildInput(value){
            let ele = document.createElement("input");
            ele.type = "number";
            ele.value = parseFloat(value) || 0;
            ele.addEventListener("change", (e)=>{
                ele.css_value = ele.value + "%";
            });
            return ele;
        }
        
        static parse(l, rule, r) {
            let tx = l.tx,
                pky = l.pk.ty;

            if (l.ty == l.types.num || tx == "-" && pky == l.types.num) {
                let mult = 1;

                if (l.ch == "-") {
                    mult = -1;
                    tx = l.p.tx;
                    l.p.next();
                }

                if (l.p.ch == "%") {
                    l.sync().next();
                    return new CSS_Percentage(parseFloat(tx) * mult);
                }
            }
            return null;
        }

        static _verify_(l) {
            if(typeof(l) == "string" &&  !isNaN(parseInt(l)) && l.includes("%"))
                return true;
            return false;
        }

        static valueHandler(){
            let ele = document.createElement("input");
            ele.type = "number";
            ele.value = 100;
            return ele;
        }

        constructor(v) {

            if (typeof(v) == "string") {
                let lex = whind(v);
                let val = CSS_Percentage.parse(lex);
                if (val) 
                    return val;
            }
            
            super(v);
        }

        toJSON() {
            return super.toString() + "%";
        }

        toString(radix) {
            return super.toString(radix) + "%";
        }

        get str() {
            return this.toString();
        }

        lerp(to, t) {
            return new CSS_Percentage(this + (to - this) * t);
        }

        copy(other){
            return new CSS_Percentage(other);
        }

        get type(){
            return "%";
        }
    }

    CSS_Percentage.label_name = "Percentage";

    class CSS_Length extends Number {

        static valueHandler(value, ui_seg){
            let ele = document.createElement("input");


            ele.type = "number";
            ele.value = (value) ? value + 0 : 0;
            
            ui_seg.css_value = ele.value + "%";
            
            ele.addEventListener("change", (e)=>{
                ele.css_value = ele.value + "px";
            });
            return ele;
        }

        static setInput(input, value){
            input.type = "number";
            input.value = value;
        }

        static buildInput(){
            let ele = document.createElement("input");
            ele.type = "number";
            return ele;
        }

        static parse(l, rule, r) {
            let tx = l.tx,
                pky = l.pk.ty;
            if (l.ty == l.types.num || tx == "-" && pky == l.types.num) {
                let sign = 1;
                if (l.ch == "-") {
                    sign = -1;
                    tx = l.p.tx;
                    l.p.next();
                }
                if (l.p.ty == l.types.id) {
                    let id = l.sync().tx;
                    l.next();
                    return new CSS_Length(parseFloat(tx) * sign, id);
                }
            }
            return null;
        }

        static _verify_(l) {
            if (typeof(l) == "string" && !isNaN(parseInt(l)) && !l.includes("%")) return true;
            return false;
        }

        constructor(v, u = "") {
            
            if (typeof(v) == "string") {
                let lex = whind$1(v);
                let val = CSS_Length.parse(lex);
                if (val) return val;
            }

            if(u){
                switch(u){
                    //Absolute
                    case "px": return new PXLength(v);
                    case "mm": return new MMLength(v);
                    case "cm": return new CMLength(v);
                    case "in": return new INLength(v);
                    case "pc": return new PCLength(v);
                    case "pt": return new PTLength(v);
                    
                    //Relative
                    case "ch": return new CHLength(v);
                    case "em": return new EMLength(v);
                    case "ex": return new EXLength(v);
                    case "rem": return new REMLength(v);

                    //View Port
                    case "vh": return new VHLength(v);
                    case "vw": return new VWLength(v);
                    case "vmin": return new VMINLength(v);
                    case "vmax": return new VMAXLength(v);

                    //Deg
                    case "deg": return new DEGLength(v);

                    case "%" : return new CSS_Percentage(v);
                }
            }

            super(v);
        }

        get milliseconds() {
            switch (this.unit) {
                case ("s"):
                    return parseFloat(this) * 1000;
            }
            return parseFloat(this);
        }

        toString(radix) {
            return super.toString(radix) + "" + this.unit;
        }

        toJSON() {
            return super.toString() + "" + this.unit;
        }

        get str() {
            return this.toString();
        }

        lerp(to, t) {
            return new CSS_Length(this + (to - this) * t, this.unit);
        }

        copy(other) {
            return new CSS_Length(other, this.unit);
        }

        set unit(t){}
        get unit(){return "";}
    }

    class PXLength extends CSS_Length {
        get unit(){return "px";}
    }
    class MMLength extends CSS_Length {
        get unit(){return "mm";}
    }
    class CMLength extends CSS_Length {
        get unit(){return "cm";}
    }
    class INLength extends CSS_Length {
        get unit(){return "in";}
    }
    class PTLength extends CSS_Length {
        get unit(){return "pt";}
    }
    class PCLength extends CSS_Length {
        get unit(){return "pc";}
    }
    class CHLength extends CSS_Length {
        get unit(){return "ch";}
    }
    class EMLength extends CSS_Length {
        get unit(){return "em";}
    }
    class EXLength extends CSS_Length {
        get unit(){return "ex";}
    }
    class REMLength extends CSS_Length {
        get unit(){return "rem";}
    }
    class VHLength extends CSS_Length {
        get unit(){return "vh";}
    }
    class VWLength extends CSS_Length {
        get unit(){return "vw";}
    }
    class VMINLength extends CSS_Length {
        get unit(){return "vmin";}
    }
    class VMAXLength extends CSS_Length {
        get unit(){return "vmax";}
    }
    class DEGLength extends CSS_Length {
        get unit(){return "deg";}
    }

    const uri_reg_ex = /(?:([^\:\?\[\]\@\/\#\b\s][^\:\?\[\]\@\/\#\b\s]*)(?:\:\/\/))?(?:([^\:\?\[\]\@\/\#\b\s][^\:\?\[\]\@\/\#\b\s]*)(?:\:([^\:\?\[\]\@\/\#\b\s]*)?)?\@)?(?:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})|((?:\[[0-9a-f]{1,4})+(?:\:[0-9a-f]{0,4}){2,7}\])|([^\:\?\[\]\@\/\#\b\s\.]{2,}(?:\.[^\:\?\[\]\@\/\#\b\s]*)*))?(?:\:(\d+))?((?:[^\?\[\]\#\s\b]*)+)?(?:\?([^\[\]\#\s\b]*))?(?:\#([^\#\s\b]*))?/i;

    const STOCK_LOCATION = {
        protocol: "",
        host: "",
        port: "",
        path: "",
        hash: "",
        query: "",
        search: ""
    };

    /** Implement Basic Fetch Mechanism for NodeJS **/
    if (typeof(fetch) == "undefined" && typeof(global) !== "undefined") {
        (async () => {
            const fs = (await import("fs")).default.promises;
            const path = (await import("path")).default;
            global.fetch = (url, data) =>
                new Promise(async (res, rej) => {
                    let p = await path.resolve(process.cwd(), (url[0] == ".") ? url + "" : "." + url);
                    try {
                        let data = await fs.readFile(p, "utf8");
                        return res({
                            status: 200,
                            text: () => {
                                return {
                                    then: (f) => f(data)
                                }
                            }
                        })
                    } catch (err) {
                        return rej(err);
                    }
                });
        })();
    }

    function fetchLocalText(URL, m = "same-origin") {
        return new Promise((res, rej) => {
            fetch(URL, {
                mode: m, // CORs not allowed
                credentials: m,
                method: "Get"
            }).then(r => {
                if (r.status < 200 || r.status > 299)
                    r.text().then(rej);
                else
                    r.text().then(res);
            }).catch(e => rej(e));
        });
    }

    function fetchLocalJSON(URL, m = "same-origin") {
        return new Promise((res, rej) => {
            fetch(URL, {
                mode: m, // CORs not allowed
                credentials: m,
                method: "Get"
            }).then(r => {
                if (r.status < 200 || r.status > 299)
                    r.json().then(rej);
                else
                    r.json().then(res).catch(rej);
            }).catch(e => rej(e));
        });
    }

    function submitForm(URL, form_data, m = "same-origin") {
        return new Promise((res, rej) => {
            var form;

            if (form_data instanceof FormData)
                form = form_data;
            else {
                form = new FormData();
                for (let name in form_data)
                    form.append(name, form_data[name] + "");
            }

            fetch(URL, {
                mode: m, // CORs not allowed
                credentials: m,
                method: "POST",
                body: form,
            }).then(r => {
                if (r.status < 200 || r.status > 299)
                    r.text().then(rej);
                else
                    r.json().then(res);
            }).catch(e => e.text().then(rej));
        });
    }

    function submitJSON(URL, json_data, m = "same-origin") {
        return new Promise((res, rej) => {
            fetch(URL, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                mode: m, // CORs not allowed
                credentials: m,
                method: "POST",
                body: JSON.stringify(json_data),
            }).then(r => {
                if (r.status < 200 || r.status > 299)
                    r.json().then(rej);
                else
                    r.json().then(res);
            }).catch(e => e.text().then(rej));
        });
    }



    /**
     * Used for processing URLs, handling `document.location`, and fetching data.
     * @param      {string}   url           The URL string to wrap.
     * @param      {boolean}  USE_LOCATION  If `true` missing URL parts are filled in with data from `document.location`. 
     * @return     {URL}   If a falsy value is passed to `url`, and `USE_LOCATION` is `true` a Global URL is returned. This is directly linked to the page and will _update_ the actual page URL when its values are change. Use with caution. 
     * @alias URL
     * @memberof module:wick.core.network
     */
    class URL {

        static resolveRelative(URL_or_url_original, URL_or_url_new) {

            let URL_old = (URL_or_url_original instanceof URL) ? URL_or_url_original : new URL(URL_or_url_original);
            let URL_new = (URL_or_url_new instanceof URL) ? URL_or_url_new : new URL(URL_or_url_new);
            if (URL_new.path[0] != "/") {

                let a = URL_old.path.split("/");
                let b = URL_new.path.split("/");


                if (b[0] == "..") a.splice(a.length - 1, 1);
                for (let i = 0; i < b.length; i++) {
                    switch (b[i]) {
                        case "..":
                        case ".":
                            a.splice(a.length - 1, 1);
                            break;
                        default:
                            a.push(b[i]);
                    }
                }
                URL_new.path = a.join("/");
            }


            return URL_new;
        }

        constructor(url = "", USE_LOCATION = false) {

            let IS_STRING = true,
                IS_LOCATION = false;


            let location = (typeof(document) !== "undefined") ? document.location : STOCK_LOCATION;

            if (url instanceof Location) {
                location = url;
                url = "";
                IS_LOCATION = true;
            }
            if (!url || typeof(url) != "string") {
                IS_STRING = false;
                IS_LOCATION = true;
                if (URL.GLOBAL && USE_LOCATION)
                    return URL.GLOBAL;
            }

            /**
             * URL protocol
             */
            this.protocol = "";

            /**
             * Username string
             */
            this.user = "";

            /**
             * Password string
             */
            this.pwd = "";

            /**
             * URL hostname
             */
            this.host = "";

            /**
             * URL network port number.
             */
            this.port = 0;

            /**
             * URL resource path
             */
            this.path = "";

            /**
             * URL query string.
             */
            this.query = "";

            /**
             * Hashtag string
             */
            this.hash = "";

            /**
             * Map of the query data
             */
            this.map = null;

            if (IS_STRING) {
                if (url instanceof URL) {
                    this.protocol = url.protocol;
                    this.user = url.user;
                    this.pwd = url.pwd;
                    this.host = url.host;
                    this.port = url.port;
                    this.path = url.path;
                    this.query = url.query;
                    this.hash = url.hash;
                } else {
                    let part = url.match(uri_reg_ex);
                    this.protocol = part[1] || ((USE_LOCATION) ? location.protocol : "");
                    this.user = part[2] || "";
                    this.pwd = part[3] || "";
                    this.host = part[4] || part[5] || part[6] || ((USE_LOCATION) ? location.hostname : "");
                    this.port = parseInt(part[7] || ((USE_LOCATION) ? location.port : 0));
                    this.path = part[8] || ((USE_LOCATION) ? location.pathname : "");
                    this.query = part[9] || ((USE_LOCATION) ? location.search.slice(1) : "");
                    this.hash = part[10] || ((USE_LOCATION) ? location.hash.slice(1) : "");

                }
            } else if (IS_LOCATION) {
                this.protocol = location.protocol.replace(/\:/g,"");
                this.host = location.hostname;
                this.port = location.port;
                this.path = location.pathname;
                this.hash = location.hash.slice(1);
                this.query = location.search.slice(1);
                this._getQuery_(this.query);

                if (USE_LOCATION) {
                    URL.G = this;
                    return URL.R;
                }
            }
            this._getQuery_(this.query);
        }


        /**
        URL Query Syntax

        root => [root_class] [& [class_list]]
             => [class_list]

        root_class = key_list

        class_list [class [& key_list] [& class_list]]

        class => name & key_list

        key_list => [key_val [& key_list]]

        key_val => name = val

        name => ALPHANUMERIC_ID

        val => NUMBER
            => ALPHANUMERIC_ID
        */

        /**
         * Pulls query string info into this.map
         * @private
         */
        _getQuery_() {
            let map = (this.map) ? this.map : (this.map = new Map());

            let lex = whind$1(this.query);


            const get_map = (k, m) => (m.has(k)) ? m.get(k) : m.set(k, new Map).get(k);

            let key = 0,
                key_val = "",
                class_map = get_map(key_val, map),
                lfv = 0;

            while (!lex.END) {
                switch (lex.tx) {
                    case "&": //At new class or value
                        if (lfv > 0)
                            key = (class_map.set(key_val, lex.s(lfv)), lfv = 0, lex.n.pos);
                        else {
                            key_val = lex.s(key);
                            key = (class_map = get_map(key_val, map), lex.n.pos);
                        }
                        continue;
                    case "=":
                        //looking for a value now
                        key_val = lex.s(key);
                        lfv = lex.n.pos;
                        continue;
                }
            }

            if (lfv > 0) class_map.set(key_val, lex.s(lfv));
        }

        setPath(path) {

            this.path = path;

            return new URL(this);
        }

        setLocation() {
            history.replaceState({}, "replaced state", `${this}`);
            window.onpopstate();
        }

        toString() {
            let str = [];

            if (this.host) {

                if (this.protocol)
                    str.push(`${this.protocol}://`);

                str.push(`${this.host}`);
            }

            if (this.port)
                str.push(`:${this.port}`);

            if (this.path)
                str.push(`${this.path[0] == "/" ? "" : "/"}${this.path}`);

            if (this.query)
                str.push(((this.query[0] == "?" ? "" : "?") + this.query));

            if (this.hash)
                str.push("#"+this.hash);


            return str.join("");
        }

        /**
         * Pulls data stored in query string into an object an returns that.
         * @param      {string}  class_name  The class name
         * @return     {object}  The data.
         */
        getData(class_name = "") {
            if (this.map) {
                let out = {};
                let _c = this.map.get(class_name);
                if (_c) {
                    for (let [key, val] of _c.entries())
                        out[key] = val;
                    return out;
                }
            }
            return null;
        }

        /**
         * Sets the data in the query string. Wick data is added after a second `?` character in the query field, and appended to the end of any existing data.
         * @param      {string}  class_name  Class name to use in query string. Defaults to root, no class 
         * @param      {object | Model | AnyModel}  data        The data
         */
        setData(data = null, class_name = "") {

            if (data) {

                let map = this.map = new Map();

                let store = (map.has(class_name)) ? map.get(class_name) : (map.set(class_name, new Map()).get(class_name));

                //If the data is a falsy value, delete the association.

                for (let n in data) {
                    if (data[n] !== undefined && typeof data[n] !== "object")
                        store.set(n, data[n]);
                    else
                        store.delete(n);
                }

                //set query
                let null_class, str = "";

                if ((null_class = map.get(""))) {
                    if (null_class.size > 0) {
                        for (let [key, val] of null_class.entries())
                            str += `&${key}=${val}`;

                    }
                }

                for (let [key, class_] of map.entries()) {
                    if (key === "")
                        continue;
                    if (class_.size > 0) {
                        str += `&${key}`;
                        for (let [key, val] of class_.entries())
                            str += `&${key}=${val}`;
                    }
                }

                str = str.slice(1);

                this.query = this.query.split("?")[0] + "?" + str;

                if (URL.G == this)
                    this.goto();
            } else {
                this.query = "";
            }

            return this;

        }

        /**
         * Fetch a string value of the remote resource. 
         * Just uses path component of URL. Must be from the same origin.
         * @param      {boolean}  [ALLOW_CACHE=true]  If `true`, the return string will be cached. If it is already cached, that will be returned instead. If `false`, a network fetch will always occur , and the result will not be cached.
         * @return     {Promise}  A promise object that resolves to a string of the fetched value.
         */
        fetchText(ALLOW_CACHE = true) {

            if (ALLOW_CACHE) {

                let resource = URL.RC.get(this.path);

                if (resource)
                    return new Promise((res) => {
                        res(resource);
                    });
            }

            return fetchLocalText(this.path).then(res => (URL.RC.set(this.path, res), res));
        }

        /**
         * Fetch a JSON value of the remote resource. 
         * Just uses path component of URL. Must be from the same origin.
         * @param      {boolean}  [ALLOW_CACHE=true]  If `true`, the return string will be cached. If it is already cached, that will be returned instead. If `false`, a network fetch will always occur , and the result will not be cached.
         * @return     {Promise}  A promise object that resolves to a string of the fetched value.
         */
        fetchJSON(ALLOW_CACHE = true) {

            let string_url = this.toString();

            if (ALLOW_CACHE) {

                let resource = URL.RC.get(string_url);

                if (resource)
                    return new Promise((res) => {
                        res(resource);
                    });
            }

            return fetchLocalJSON(string_url).then(res => (URL.RC.set(this.path, res), res));
        }

        /**
         * Cache a local resource at the value 
         * @param    {object}  resource  The resource to store at this URL path value.
         * @returns {boolean} `true` if a resource was already cached for this URL, false otherwise.
         */
        cacheResource(resource) {

            let occupied = URL.RC.has(this.path);

            URL.RC.set(this.path, resource);

            return occupied;
        }

        submitForm(form_data) {
            return submitForm(this.toString(), form_data);
        }

        submitJSON(json_data) {
            return submitJSON(this.toString(), json_data);
        }
        /**
         * Goes to the current URL.
         */
        goto() {
            return;
            let url = this.toString();
            history.pushState({}, "ignored title", url);
            window.onpopstate();
            URL.G = this;
        }

        get pathname() {
            return this.path;
        }

        get href() {
            return this.toString();
        }
    }

    /**
     * The fetched resource cache.
     */
    URL.RC = new Map();

    /**
     * The Default Global URL object. 
     */
    URL.G = null;

    /**
     * The Global object Proxy.
     */
    URL.R = {
        get protocol() {
            return URL.G.protocol;
        },
        set protocol(v) {
            return;
            URL.G.protocol = v;
        },
        get user() {
            return URL.G.user;
        },
        set user(v) {
            return;
            URL.G.user = v;
        },
        get pwd() {
            return URL.G.pwd;
        },
        set pwd(v) {
            return;
            URL.G.pwd = v;
        },
        get host() {
            return URL.G.host;
        },
        set host(v) {
            return;
            URL.G.host = v;
        },
        get port() {
            return URL.G.port;
        },
        set port(v) {
            return;
            URL.G.port = v;
        },
        get path() {
            return URL.G.path;
        },
        set path(v) {
            return;
            URL.G.path = v;
        },
        get query() {
            return URL.G.query;
        },
        set query(v) {
            return;
            URL.G.query = v;
        },
        get hash() {
            return URL.G.hash;
        },
        set hash(v) {
            return;
            URL.G.hash = v;
        },
        get map() {
            return URL.G.map;
        },
        set map(v) {
            return;
            URL.G.map = v;
        },
        setPath(path) {
            return URL.G.setPath(path);
        },
        setLocation() {
            return URL.G.setLocation();
        },
        toString() {
            return URL.G.toString();
        },
        getData(class_name = "") {
            return URL.G.getData(class_name = "");
        },
        setData(class_name = "", data = null) {
            return URL.G.setData(class_name, data);
        },
        fetchText(ALLOW_CACHE = true) {
            return URL.G.fetchText(ALLOW_CACHE);
        },
        cacheResource(resource) {
            return URL.G.cacheResource(resource);
        }
    };
    Object.freeze(URL.R);
    Object.freeze(URL.RC);
    Object.seal(URL);

    class CSS_URL extends URL {
        static parse(l, rule, r) {
            if (l.tx == "url" || l.tx == "uri") {
                l.next().a("(");
                let v = "";
                if (l.ty == l.types.str) {
                    v = l.tx.slice(1,-1);
                    l.next().a(")");
                } else {
                    const p = l.peek();
                    while (!p.END && p.next().tx !== ")") { /* NO OP */ }
                    v = p.slice(l);
                    l.sync().a(")");
                }
                return new CSS_URL(v);
            } if (l.ty == l.types.str){
                let v = l.tx.slice(1,-1);
                l.next();
                return new CSS_URL(v);
            }

            return null;
        }
    }

    class CSS_String extends String {
        
        static list(){}

        static valueHandler(existing_value){
            let ele = document.createElement("input");
            ele.type = "text";
            ele.value = existing_value || "";
            return ele;
        }

        static setInput(input, value){
            input.type = "text";
            input.value = value;
        }

        static buildInput(){
            let ele = document.createElement("input");
            ele.type = "text";
            return ele;
        }

        static parse(l, rule, r) {
            if (l.ty == l.types.str) {
                let tx = l.tx;
                l.next();
                return new CSS_String(tx);
            }
            return null;
        }

        constructor(string){
            if(string[0] == "\"" || string[0] == "\'" || string[0] == "\'")
                string = string.slice(1,-1);
            super(string);
        }
    }

    class CSS_Id extends String {
        static parse(l, rule, r) {
            if (l.ty == l.types.id) {
                let tx = l.tx;
                l.next();
                return new CSS_Id(tx);
            }
            return null;
        }
    }

    /* https://www.w3.org/TR/css-shapes-1/#typedef-basic-shape */
    class CSS_Shape extends Array {
        static parse(l, rule, r) {
            if (l.tx == "inset" || l.tx == "circle" || l.tx == "ellipse" || l.tx == "polygon" || l.tx == "rect") {
                l.next().a("(");
                let v = "";
                if (l.ty == l.types.str) {
                    v = l.tx.slice(1,-1);
                    l.next().a(")");
                } else {
                    let p = l.pk;
                    while (!p.END && p.next().tx !== ")") { /* NO OP */ }
                    v = p.slice(l);
                    l.sync().a(")");
                }
                return new CSS_Shape(v);
            }
            return null;
        }
    }

    class CSS_Number extends Number {

        static valueHandler(value){
            let ele = document.createElement("input");
            ele.type = "number";
            ele.value = (value) ? value + 0 : 0;
            ele.addEventListener("change", (e)=>{
                ele.css_value = ele.value;
            });
            return ele;
        }

        static setInput(input, value){
            input.type = "number";
            input.value = value;
        }

        static buildInput(){
            let ele = document.createElement("input");
            ele.type = "number";
            return ele;
        }

        static parse(l, rule, r) {
            
            let sign = 1;

            if(l.ch == "-" && l.pk.ty == l.types.num){
            	l.sync();
            	sign = -1;
            }

            if(l.ty == l.types.num){
            	let tx = l.tx;
                l.next();
                return new CSS_Number(sign*(new Number(tx)));
            }
            return null;
        }
    }

    class Point2D extends Float64Array{
    	
    	constructor(x, y) {
    		super(2);

    		if (typeof(x) == "number") {
    			this[0] = x;
    			this[1] = y;
    			return;
    		}

    		if (x instanceof Array) {
    			this[0] = x[0];
    			this[1] = x[1];
    		}
    	}

    	draw(ctx, s = 1){
    		ctx.beginPath();
    		ctx.moveTo(this.x*s,this.y*s);
    		ctx.arc(this.x*s, this.y*s, s*0.01, 0, 2*Math.PI);
    		ctx.stroke();
    	}

    	get x (){ return this[0]}
    	set x (v){if(typeof(v) !== "number") return; this[0] = v;}

    	get y (){ return this[1]}
    	set y (v){if(typeof(v) !== "number") return; this[1] = v;}
    }

    const sqrt = Math.sqrt;
    const cos = Math.cos;
    const acos = Math.acos;
    const PI = Math.PI; 
    const pow = Math.pow;

    // A real-cuberoots-only function:
    function cuberoot(v) {
      if(v<0) return -pow(-v,1/3);
      return pow(v,1/3);
    }

    function point(t, p1, p2, p3, p4) {
    	var ti = 1 - t;
    	var ti2 = ti * ti;
    	var t2 = t * t;
    	return ti * ti2 * p1 + 3 * ti2 * t * p2 + t2 * 3 * ti * p3 + t2 * t * p4;
    }


    class CBezier extends Float64Array{
    	constructor(x1, y1, x2, y2, x3, y3, x4, y4) {
    		super(8);

    		//Map P1 and P2 to {0,0,1,1} if only four arguments are provided; for use with animations
    		if(arguments.length == 4){
    			this[0] = 0;
    			this[1] = 0;
    			this[2] = x1;
    			this[3] = y1;
    			this[4] = x2;
    			this[5] = y2;
    			this[6] = 1;
    			this[7] = 1;
    			return;
    		}
    		
    		if (typeof(x1) == "number") {
    			this[0] = x1;
    			this[1] = y1;
    			this[2] = x2;
    			this[3] = y2;
    			this[4] = x3;
    			this[5] = y3;
    			this[6] = x4;
    			this[7] = y4;
    			return;
    		}

    		if (x1 instanceof Array) {
    			this[0] = x1[0];
    			this[1] = x1[1];
    			this[2] = x1[2];
    			this[3] = x1[3];
    			this[4] = x1[4];
    			this[5] = x1[5];
    			this[6] = x1[6];
    			this[7] = x1[4];
    			return;
    		}
    	}

    	get x1 (){ return this[0]}
    	set x1 (v){this[0] = v;}
    	get x2 (){ return this[2]}
    	set x2 (v){this[2] = v;}
    	get x3 (){ return this[4]}
    	set x3 (v){this[4] = v;}
    	get x4 (){ return this[6]}
    	set x4 (v){this[6] = v;}
    	get y1 (){ return this[1]}
    	set y1 (v){this[1] = v;}
    	get y2 (){ return this[3]}
    	set y2 (v){this[3] = v;}
    	get y3 (){ return this[5]}
    	set y3 (v){this[5] = v;}
    	get y4 (){ return this[7]}
    	set y4 (v){this[7] = v;}

    	add(x,y = 0){
    		return new CCurve(
    			this[0] + x,
    			this[1] + y,
    			this[2] + x,
    			this[3] + y,
    			this[4] + x,
    			this[5] + y,
    			this[6] + x,
    			this[7] + y
    		)
    	}

    	valY(t){
    		return point(t, this[1], this[3], this[5], this[7]);
    	}

    	valX(t){
    		return point(t, this[0], this[2], this[4], this[6]);
    	}

    	point(t) {
    		return new Point2D(
    			point(t, this[0], this[2], this[4], this[6]),
    			point(t, this[1], this[3], this[5], this[7])
    		)
    	}
    	
    	/** 
    		Acquired from : https://pomax.github.io/bezierinfo/
    		Author:  Mike "Pomax" Kamermans
    		GitHub: https://github.com/Pomax/
    	*/

    	roots(p1,p2,p3,p4) {
    		var d = (-p1 + 3 * p2 - 3 * p3 + p4),
    			a = (3 * p1 - 6 * p2 + 3 * p3) / d,
    			b = (-3 * p1 + 3 * p2) / d,
    			c = p1 / d;

    		var p = (3 * b - a * a) / 3,
    			p3 = p / 3,
    			q = (2 * a * a * a - 9 * a * b + 27 * c) / 27,
    			q2 = q / 2,
    			discriminant = q2 * q2 + p3 * p3 * p3;

    		// and some variables we're going to use later on:
    		var u1, v1, root1, root2, root3;

    		// three possible real roots:
    		if (discriminant < 0) {
    			var mp3 = -p / 3,
    				mp33 = mp3 * mp3 * mp3,
    				r = sqrt(mp33),
    				t = -q / (2 * r),
    				cosphi = t < -1 ? -1 : t > 1 ? 1 : t,
    				phi = acos(cosphi),
    				crtr = cuberoot(r),
    				t1 = 2 * crtr;
    			root1 = t1 * cos(phi / 3) - a / 3;
    			root2 = t1 * cos((phi + 2 * PI) / 3) - a / 3;
    			root3 = t1 * cos((phi + 4 * PI) / 3) - a / 3;
    			return [root3, root1, root2]
    		}

    		// three real roots, but two of them are equal:
    		if (discriminant === 0) {
    			u1 = q2 < 0 ? cuberoot(-q2) : -cuberoot(q2);
    			root1 = 2 * u1 - a / 3;
    			root2 = -u1 - a / 3;
    			return [root2, root1];
    		}

    		// one real root, two complex roots
    		var sd = sqrt(discriminant);
    		u1 = cuberoot(sd - q2);
    		v1 = cuberoot(sd + q2);
    		root1 = u1 - v1 - a / 3;
    		return [root1];
    	}

    	rootsY() {
    		return this.roots(this[1],this[3],this[5],this[7]);
    	}

    	rootsX() {
    		return this.roots(this[0],this[2],this[4],this[6]);
    	}
    	
    	getYatX(x){
    		var x1 = this[0] - x, x2 = this[2] - x, x3 = this[4] - x, x4 = this[6] - x,
    			x2_3 = x2 * 3, x1_3 = x1 *3, x3_3 = x3 * 3,
    			d = (-x1 + x2_3 - x3_3 + x4), di = 1/d, i3 = 1/3,
    			a = (x1_3 - 6 * x2 + x3_3) * di,
    			b = (-x1_3 + x2_3) * di,
    			c = x1 * di,
    			p = (3 * b - a * a) * i3,
    			p3 = p * i3,
    			q = (2 * a * a * a - 9 * a * b + 27 * c) * (1/27),
    			q2 = q * 0.5,
    			discriminant = q2 * q2 + p3 * p3 * p3;

    		// and some variables we're going to use later on:
    		var u1, v1, root;

    		//Three real roots can never happen if p1(0,0) and p4(1,1);

    		// three real roots, but two of them are equal:
    		if (discriminant < 0) {
    			var mp3 = -p / 3,
    				mp33 = mp3 * mp3 * mp3,
    				r = sqrt(mp33),
    				t = -q / (2 * r),
    				cosphi = t < -1 ? -1 : t > 1 ? 1 : t,
    				phi = acos(cosphi),
    				crtr = cuberoot(r),
    				t1 = 2 * crtr;
    			root = t1 * cos((phi + 4 * PI) / 3) - a / 3;
    		}else if (discriminant === 0) {
    			u1 = q2 < 0 ? cuberoot(-q2) : -cuberoot(q2);
    			root = -u1 - a * i3;
    		}else{
    			var sd = sqrt(discriminant);
    			// one real root, two complex roots
    			u1 = cuberoot(sd - q2);
    			v1 = cuberoot(sd + q2);
    			root = u1 - v1 - a * i3;	
    		}

    		return point(root, this[1], this[3], this[5], this[7]);
    	}
    	/**
    		Given a Canvas 2D context object and scale value, strokes a cubic bezier curve.
    	*/
    	draw(ctx, s = 1){
    		ctx.beginPath();
    		ctx.moveTo(this[0]*s, this[1]*s);
    		ctx.bezierCurveTo(
    			this[2]*s, this[3]*s,
    			this[4]*s, this[5]*s,
    			this[6]*s, this[7]*s
    			);
    		ctx.stroke();
    	}
    }

    class CSS_Bezier extends CBezier {
    	static parse(l, rule, r) {

    		let out = null;

    		switch(l.tx){
    			case "cubic":
    				l.next().a("(");
    				let v1 = parseFloat(l.tx);
    				let v2 = parseFloat(l.next().a(",").tx);
    				let v3 = parseFloat(l.next().a(",").tx);
    				let v4 = parseFloat(l.next().a(",").tx);
    				l.a(")");
    				out = new CSS_Bezier(v1, v2, v3, v4);
    				break;
    			case "ease":
    				l.next();
    				out = new CSS_Bezier(0.25, 0.1, 0.25, 1);
    				break;
    			case "ease-in":
    				l.next();
    				out = new CSS_Bezier(0.42, 0, 1, 1);
    				break;
    			case "ease-out":
    				l.next();
    				out = new CSS_Bezier(0, 0, 0.58, 1);
    				break;
    			case "ease-in-out":
    				l.next();
    				out = new CSS_Bezier(0.42, 0, 0.58, 1);
    				break;
    		}

    		return out;
    	}

    	toString(){
    		 return `cubic-bezier(${this[2]},${this[3]},${this[4]},${this[5]})`;
    	}
    }

    class Stop{
        constructor(color, percentage){
            this.color = color;
            this.percentage = percentage || null;
        }

        toString(){
            return `${this.color}${(this.percentage)?" "+this.percentage:""}`;
        }
    }

    class CSS_Gradient{

        static parse(l, rule, r) {
            let tx = l.tx,
                pky = l.pk.ty;
            if (l.ty == l.types.id) {
                switch(l.tx){
                    case "linear-gradient":
                    l.next().a("(");
                    let num,type ="deg";
                    if(l.tx == "to");else if(l.ty == l.types.num){
                        num = parseFloat(l.ty);
                        type = l.next().tx;
                        l.next().a(',');
                    }

                    let stops = [];
                    
                    while(!l.END && l.ch != ")"){
                        let v = CSS_Color.parse(l, rule, r);
                        let len = null;

                        if(l.ch == ")") {
                            stops.push(new Stop(v, len));
                            break;
                        }
                        
                        if(l.ch != ","){
                            if(!(len = CSS_Length.parse(l, rule, r)))
                                len = CSS_Percentage.parse(l,rule,r);
                        }else
                            l.next();
                        

                        stops.push(new Stop(v, len));
                    }
                    l.a(")");
                    let grad = new CSS_Gradient();
                    grad.stops = stops;
                    return grad;
                }
            }
            return null;
        }


        constructor(type = 0){
            this.type = type; //linear gradient
            this.direction = new CSS_Length(0, "deg");
            this.stops = [];
        }

        toString(){
            let str = [];
            switch(this.type){
                case 0:
                str.push("linear-gradient(");
                if(this.direction !== 0)
                    str.push(this.direction.toString() + ",");
                break;
            }

            for(let i = 0; i < this.stops.length; i++)
                str.push(this.stops[i].toString()+((i<this.stops.length-1)?",":""));

            str.push(")");

            return str.join(" ");
        }
    }

    const $medh = (prefix) => ({
        parse: (l, r, a, n = 0) => (n = CSS_Length.parse(l, r, a), (prefix > 0) ? ((prefix > 1) ? (win) => win.innerHeight <= n : (win) => win.innerHeight >= n) : (win) => win.screen.height == n)
    });


    const $medw = (prefix) => ({
        parse: (l, r, a, n = 0) => 
            (n = CSS_Length.parse(l, r, a), (prefix > 0) ? ((prefix > 1) ? (win) => win.innerWidth >= n : (win) => win.innerWidth <= n) : (win) => win.screen.width == n)
    });

    function CSS_Media_handle(type, prefix) {
        switch (type) {
            case "h":
                return $medh(prefix);
            case "w":
                return $medw(prefix);
        }

        return {
            parse: function(a, b, c) {
                debugger;
            }
        };
    }

    function getValue(lex, attribute) {
        let v = lex.tx,
            mult = 1;

        if (v == "-")
            v = lex.n.tx, mult = -1;

        let n = parseFloat(v) * mult;

        lex.next();

        if (lex.ch !== ")" && lex.ch !== ",") {
            switch (lex.tx) {
                case "%":
                    break;

                /* Rotational Values */
                case "grad":
                    n *= Math.PI / 200;
                    break;
                case "deg":
                    n *= Math.PI / 180;
                    break;
                case "turn":
                    n *= Math.PI * 2;
                    break;
                case "px":
                    break;
                case "em":
                    break;
            }
            lex.next();
        }
        return n;
    }

    function ParseString(string, transform) {
        let lex = null;
        lex = string;

        if(typeof(string) == "string")
            lex = whind$1(string);
        
        while (!lex.END) {
            let tx = lex.tx;
            lex.next();
            switch (tx) {
                case "matrix":

                    let a = getValue(lex.a("(")),
                        b = getValue(lex.a(",")),
                        c = getValue(lex.a(",")),
                        d = getValue(lex.a(",")),
                        r = -Math.atan2(b, a),
                        sx1 = (a / Math.cos(r)) || 0,
                        sx2 = (b / -Math.sin(r)) || 0,
                        sy1 = (c / Math.sin(r)) || 0,
                        sy2 = (d / Math.cos(r)) || 0;
                    
                    if(sx2 !== 0)
                        transform.sx = (sx1 + sx2) * 0.5;
                    else
                        transform.sx = sx1;

                    if(sy1 !== 0)
                        transform.sy = (sy1 + sy2) * 0.5;
                    else
                        transform.sy = sy2;

                    transform.px = getValue(lex.a(","));
                    transform.py = getValue(lex.a(","));
                    transform.r = r;
                    lex.a(")");
                    break;
                case "matrix3d":
                    break;
                case "translate":
                    transform.px = getValue(lex.a("("), "left");
                    lex.a(",");
                    transform.py = getValue(lex, "left");
                    lex.a(")");
                    continue;
                case "translateX":
                    transform.px = getValue(lex.a("("), "left");
                    lex.a(")");
                    continue;
                case "translateY":
                    transform.py = getValue(lex.a("("), "left");
                    lex.a(")");
                    continue;
                case "scale":
                    transform.sx = getValue(lex.a("("), "left");
                    if(lex.ch ==","){
                        lex.a(",");
                        transform.sy = getValue(lex, "left");
                    }
                    else transform.sy = transform.sx;
                    lex.a(")");
                    continue;
                case "scaleX":
                    transform.sx = getValue(lex.a("("), "left");
                    lex.a(")");
                    continue;
                case "scaleY":
                    transform.sy = getValue(lex.a("("), "left");
                    lex.a(")");
                    continue;
                case "scaleZ":
                    break;
                case "rotate":
                    transform.r = getValue(lex.a("("));
                    lex.a(")");
                    continue;
                case "rotateX":
                    break;
                case "rotateY":
                    break;
                case "rotateZ":
                    break;
                case "rotate3d":
                    break;
                case "perspective":
                    break;
            }
            lex.next();
        }
    }
    // A 2D transform composition of 2D position, 2D scale, and 1D rotation.

    class CSS_Transform2D extends Float64Array {
        static ToString(pos = [0, 0], scl = [1, 1], rot = 0) {
            var px = 0,
                py = 0,
                sx = 1,
                sy = 1,
                r = 0, cos = 1, sin = 0;
            if (pos.length == 5) {
                px = pos[0];
                py = pos[1];
                sx = pos[2];
                sy = pos[3];
                r = pos[4];
            } else {
                px = pos[0];
                py = pos[1];
                sx = scl[0];
                sy = scl[1];
                r = rot;
            }
            
            if(r !== 0){
                cos = Math.cos(r);
                sin = Math.sin(r);
            }

            return `matrix(${cos * sx}, ${-sin * sx}, ${sy * sin}, ${sy * cos}, ${px}, ${py})`;
        }


        constructor(px, py, sx, sy, r) {
            super(5);
            this.sx = 1;
            this.sy = 1;
            if (px !== undefined) {
                if (px instanceof CSS_Transform2D) {
                    this[0] = px[0];
                    this[1] = px[1];
                    this[2] = px[2];
                    this[3] = px[3];
                    this[4] = px[4];
                } else if (typeof(px) == "string") ParseString(px, this);
                else {
                    this[0] = px;
                    this[1] = py;
                    this[2] = sx;
                    this[3] = sy;
                    this[4] = r;
                }
            }
        }
        get px() {
            return this[0];
        }
        set px(v) {
            this[0] = v;
        }
        get py() {
            return this[1];
        }
        set py(v) {
            this[1] = v;
        }
        get sx() {
            return this[2];
        }
        set sx(v) {
            this[2] = v;
        }
        get sy() {
            return this[3];
        }
        set sy(v) {
            this[3] = v;
        }
        get r() {
            return this[4];
        }
        set r(v) {
            this[4] = v;
        }

        set scale(s){
            this.sx = s;
            this.sy = s;
        }

        get scale(){
            return this.sx;
        }
        
        lerp(to, t) {
            let out = new CSS_Transform2D();
            for (let i = 0; i < 5; i++) out[i] = this[i] + (to[i] - this[i]) * t;
            return out;
        }
        toString() {
            return CSS_Transform2D.ToString(this);
        }

        copy(v) {
            let copy = new CSS_Transform2D(this);


            if (typeof(v) == "string")
                ParseString(v, copy);

            return copy;
        }

        /**
         * Sets the transform value of a canvas 2D context;
         */
        setCTX(ctx){       
            let cos = 1, sin = 0;
            if(this[4] != 0){
                cos = Math.cos(this[4]);
                sin = Math.sin(this[4]);
            }
            ctx.transform(cos * this[2], -sin * this[2], this[3] * sin, this[3] * cos, this[0], this[1]);
        }

        getLocalX(X){
            return (X - this.px) / this.sx;
        }

        getLocalY(Y){
            return (Y - this.py) / this.sy;
        }
    }

    /**
     * @brief Path Info
     * @details Path syntax information for reference
     * 
     * MoveTo: M, m
     * LineTo: L, l, H, h, V, v
     * Cubic Bézier Curve: C, c, S, s
     * Quadratic Bézier Curve: Q, q, T, t
     * Elliptical Arc Curve: A, a
     * ClosePath: Z, z
     * 
     * Capital symbols represent absolute positioning, lowercase is relative
     */
    const PathSym = {
        M: 0,
        m: 1,
        L: 2,
        l: 3,
        h: 4,
        H: 5,
        V: 6,
        v: 7,
        C: 8,
        c: 9,
        S: 10,
        s: 11,
        Q: 12,
        q: 13,
        T: 14,
        t: 15,
        A: 16,
        a: 17,
        Z: 18,
        z: 19,
        pairs: 20
    };

    function getSignedNumber(lex) {
        let mult = 1,
            tx = lex.tx;
        if (tx == "-") {
            mult = -1;
            tx = lex.n.tx;
        }
        lex.next();
        return parseFloat(tx) * mult;
    }

    function getNumberPair(lex, array) {
        let x = getSignedNumber(lex);
        if (lex.ch == ',') lex.next();
        let y = getSignedNumber(lex);
        array.push(x, y);
    }

    function parseNumberPairs(lex, array) {
        while ((lex.ty == lex.types.num || lex.ch == "-") && !lex.END) {    	
        	array.push(PathSym.pairs);
            getNumberPair(lex, array);
        }
    }
    /**
     * @brief An array store of path data in numerical form
     */
    class CSS_Path extends Array {
        static FromString(string, array) {
            let lex = whind(string);
            while (!lex.END) {
                let relative = false,
                    x = 0,
                    y = 0;
                switch (lex.ch) {
                    //Move to
                    case "m":
                        relative = true;
                    case "M":
                        lex.next(); //
                        array.push((relative) ? PathSym.m : PathSym.M);
                        getNumberPair(lex, array);
                        parseNumberPairs(lex, array);
                        continue;
                        //Line to
                    case "h":
                        relative = true;
                    case "H":
                        lex.next();
                        x = getSignedNumber(lex);
                        array.push((relative) ? PathSym.h : PathSym.H, x);
                        continue;
                    case "v":
                        relative = true;
                    case "V":
                        lex.next();
                        y = getSignedNumber(lex);
                        array.push((relative) ? PathSym.v : PathSym.V, y);
                        continue;
                    case "l":
                        relative = true;
                    case "L":
                        lex.next();
                        array.push((relative) ? PathSym.l : PathSym.L);
                        getNumberPair(lex, array);
                        parseNumberPairs(lex, array);
                        continue;
                        //Cubic Curve
                    case "c":
                        relative = true;
                    case "C":
                        array.push((relative) ? PathSym.c : PathSym.C);
                        getNumberPair(lex, array);
                        getNumberPair(lex, array);
                        getNumberPair(lex, array);
                        parseNumberPairs(lex, array);
                        continue;
                    case "s":
                        relative = true;
                    case "S":
                        array.push((relative) ? PathSym.s : PathSym.S);
                        getNumberPair(lex, array);
                        getNumberPair(lex, array);
                        parseNumberPairs(lex, array);
                        continue;
                        //Quadratic Curve0
                    case "q":
                        relative = true;
                    case "Q":
                        array.push((relative) ? PathSym.q : PathSym.Q);
                        getNumberPair(lex, array);
                        getNumberPair(lex, array);
                        parseNumberPairs(lex, array);
                        continue;
                    case "t":
                        relative = true;
                    case "T":
                        array.push((relative) ? PathSym.t : PathSym.T);
                        getNumberPair(lex, array);
                        parseNumberPairs(lex, array);
                        continue;
                        //Elliptical Arc
                        //Close path:
                    case "z":
                        relative = true;
                    case "Z":
                        array.push((relative) ? PathSym.z : PathSym.Z);
                }
                lex.next();
            }
        }

        static ToString(array) {
        	let string = [], l = array.length, i = 0;
        	while(i < l){
        		switch(array[i++]){
        			case PathSym.M:
        				string.push("M", array[i++], array[i++]);
        				break;
    			    case PathSym.m:
    			    	string.push("m", array[i++], array[i++]);
    			    	break;
    			    case PathSym.L:
    			    	string.push("L", array[i++], array[i++]);
    			    	break;
    			    case PathSym.l:
    			    	string.push("l", array[i++], array[i++]);
    			    	break;
    			    case PathSym.h:
    			    	string.push("h", array[i++]);
    			    	break;
    			    case PathSym.H:
    			    	string.push("H", array[i++]);
    			    	break;
    			    case PathSym.V:
    			    	string.push("V", array[i++]);
    			    	break;
    			    case PathSym.v:
    			    	string.push("v", array[i++]);
    			    	break;
    			    case PathSym.C:
    			    	string.push("C", array[i++], array[i++], array[i++], array[i++], array[i++], array[i++]);
    			    	break;
    			    case PathSym.c:
    			    	string.push("c", array[i++], array[i++], array[i++], array[i++], array[i++], array[i++]);
    			    	break;
    			    case PathSym.S:
    			    	string.push("S", array[i++], array[i++], array[i++], array[i++]);
    			    	break;
    			    case PathSym.s:
    			    	string.push("s", array[i++], array[i++], array[i++], array[i++]);
    			    	break;
    			    case PathSym.Q:
    			    	string.push("Q", array[i++], array[i++], array[i++], array[i++]);
    			    	break;
    			    case PathSym.q:
    			    	string.push("q", array[i++], array[i++], array[i++], array[i++]);
    			    	break;
    			    case PathSym.T:
    			    	string.push("T", array[i++], array[i++]);
    			    	break;
    			    case PathSym.t:
    			    	string.push("t", array[i++], array[i++]);
    			    	break;
    			    case PathSym.Z:
    			    	string.push("Z");
    			    	break;
    			    case PathSym.z:
    			    	string.push("z");
    			    	break;
    			    case PathSym.pairs:
    			    	string.push(array[i++], array[i++]);
    			    	break;
    			 	case PathSym.A:
    			    case PathSym.a:
    			    default:
    			    	i++;
        		}
        	}

        	return string.join(" ");
        }

        
        constructor(data) {
            super();	

        	if(typeof(data) == "string"){
        		Path.FromString(data, this);
        	}else if(Array.isArray(data)){
        		for(let i = 0; i < data.length;i++){
        			this.push(parseFloat(data[i]));
        		}
        	}
        }

        toString(){
        	return Path.ToString(this);
        }

        lerp(to, t, array = new Path){
        	let l = Math.min(this.length, to.length);

        	for(let i = 0; i < l; i++)
        		array[i] = this[i] + (to[i] - this[i]) * t;

        	return array;
        }	
    }

    class CSS_FontName extends String {
    	static parse(l, rule, r) {

    		if(l.ty == l.types.str){
    			let tx = l.tx;
                l.next();
    			return new CSS_String(tx);
    		}		

    		if(l.ty == l.types.id){

    			let pk = l.peek();

    			while(pk.type == l.types.id && !pk.END){
    				pk.next();
    			}

    			let str = pk.slice(l);
    			
    			l.sync();
    			return new CSS_String(str);
    		}

            return null;
        }
    }

    /**
     * CSS Type constructors
     * @alias module:wick~internals.css.types.
     * @enum {object}
     * https://www.w3.org/TR/CSS2/about.html#property-defs
     */
    const types = {
    	color: CSS_Color,
    	length: CSS_Length,
    	time: CSS_Length,
    	flex: CSS_Length,
    	angle: CSS_Length,
    	frequency: CSS_Length,
    	resolution: CSS_Length,
    	percentage: CSS_Percentage,
    	url: CSS_URL,
    	uri: CSS_URL,
    	number: CSS_Number,
    	id: CSS_Id,
    	string: CSS_String,
    	shape: CSS_Shape,
    	cubic_bezier: CSS_Bezier,
    	integer: CSS_Number,
    	gradient: CSS_Gradient,
    	transform2D : CSS_Transform2D,
    	path: CSS_Path,
    	fontname: CSS_FontName,

    	/* Media parsers */
    	m_width: CSS_Media_handle("w", 0),
    	m_min_width: CSS_Media_handle("w", 1),
    	m_max_width: CSS_Media_handle("w", 2),
    	m_height: CSS_Media_handle("h", 0),
    	m_min_height: CSS_Media_handle("h", 1),
    	m_max_height: CSS_Media_handle("h", 2),
    	m_device_width: CSS_Media_handle("dw", 0),
    	m_min_device_width: CSS_Media_handle("dw", 1),
    	m_max_device_width: CSS_Media_handle("dw", 2),
    	m_device_height: CSS_Media_handle("dh", 0),
    	m_min_device_height: CSS_Media_handle("dh", 1),
    	m_max_device_height: CSS_Media_handle("dh", 2)
    };

    /**
     * CSS Property Definitions https://www.w3.org/TR/css3-values/#value-defs
     * @alias module:wick~internals.css.property_definitions.
     * @enum {string}
     */
    const property_definitions = {

    	/* https://drafts.csswg.org/css-writing-modes-3/ */
    		direction:"ltr|rtl",
    		unicode_bidi:"normal|embed|isolate|bidi-override|isolate-override|plaintext",
    		writing_mode:"horizontal-tb|vertical-rl|vertical-lr",
    		text_orientation:"mixed|upright|sideways",
    		glyph_orientation_vertical:`auto|0deg|90deg|"0"|"90"`,
    		text_combine_upright:"none|all",

    	/* https://www.w3.org/TR/css-position-3 */ 
    		position: "static|relative|absolute|sticky|fixed",
    		top: `<length>|<percentage>|auto`,
    		left: `<length>|<percentage>|auto`,
    		bottom: `<length>|<percentage>|auto`,
    		right: `<length>|<percentage>|auto`,
    		offset_before: `<length>|<percentage>|auto`,
    		offset_after: `<length>|<percentage>|auto`,
    		offset_start: `<length>|<percentage>|auto`,
    		offset_end: `<length>|<percentage>|auto`,
    		z_index:"auto|<integer>",

    	/* https://www.w3.org/TR/css-display-3/ */
    		display: `[ <display_outside> || <display_inside> ] | <display_listitem> | <display_internal> | <display_box> | <display_legacy>`,

    	/* https://www.w3.org/TR/css-box-3 */
    		margin: `[<length>|<percentage>|0|auto]{1,4}`,
    		margin_top: `<length>|<percentage>|0|auto`,
    		margin_right: `<length>|<percentage>|0|auto`,
    		margin_bottom: `<length>|<percentage>|0|auto`,
    		margin_left: `<length>|<percentage>|0|auto`,

    		margin_trim:"none|in-flow|all",

    		padding: `[<length>|<percentage>|0|auto]{1,4}`,
    		padding_top: `<length>|<percentage>|0|auto`,
    		padding_right: `<length>|<percentage>|0|auto`,
    		padding_bottom: `<length>|<percentage>|0|auto`,
    		padding_left: `<length>|<percentage>|0|auto`,

    	/* https://www.w3.org/TR/CSS2/visuren.html */
    		float: `left|right|none`,
    		clear: `left|right|both|none`,

    	/* https://drafts.csswg.org/css-sizing-3 todo:implement fit-content(%) function */
    		box_sizing: `content-box | border-box`,
    		width: `<length>|<percentage>|min-content|max-content|fit-content|auto`,
    		height: `<length>|<percentage>|min-content|max-content|fit-content|auto`,
    		min_width: `<length>|<percentage>|min-content|max-content|fit-content|auto`,
    		max_width: `<length>|<percentage>|min-content|max-content|fit-content|auto|none`,
    		min_height: `<length>|<percentage>|min-content|max-content|fit-content|auto`,
    		max_height: `<length>|<percentage>|min-content|max-content|fit-content|auto|none`,

    	/* https://www.w3.org/TR/2018/REC-css-color-3-20180619 */
    		color: `<color>`,
    		opacity: `<alphavalue>`,

    	/* https://www.w3.org/TR/css-backgrounds-3/ */
    		background_color: `<color>`,
    		background_image: `<bg_image>#`,
    		background_repeat: `<repeat_style>#`,
    		background_attachment: `scroll|fixed|local`,
    		background_position: `[<percentage>|<length>]{1,2}|[top|center|bottom]||[left|center|right]`,
    		background_clip: `<box>#`,
    		background_origin: `<box>#`,
    		background_size: `<bg_size>#`,
    		background: `[<bg_layer>#,]?<final_bg_layer>`,
    		border_color: `<color>{1,4}`,
    		border_top_color: `<color>`,
    		border_right_color: `<color>`,
    		border_bottom_color: `<color>`,
    		border_left_color: `<color>`,

    		border_top_width: `<line_width>`,
    		border_right_width: `<line_width>`,
    		border_bottom_width: `<line_width>`,
    		border_left_width: `<line_width>`,
    		border_width: `<line_width>{1,4}`,

    		border_style: `<line_style>{1,4}`,
    		border_top_style: `<line_style>`,
    		border_right_style: `<line_style>`,
    		border_bottom_style: `<line_style>`,
    		border_left_style: `<line_style>`,

    		border_top: `<line_width>||<line_style>||<color>`,
    		border_right: `<line_width>||<line_style>||<color>`,
    		border_bottom: `<line_width>||<line_style>||<color>`,
    		border_left: `<line_width>||<line_style>||<color>`,

    		border_radius: `<length_percentage>{1,4}[ / <length_percentage>{1,4}]?`,
    		border_top_left_radius: `<length_percentage>{1,2}`,
    		border_top_right_radius: `<length_percentage>{1,2}`,
    		border_bottom_right_radius: `<length_percentage>{1,2}`,
    		border_bottom_left_radius: `<length_percentage>{1,2}`,

    		border: `<line_width>||<line_style>||<color>`,

    		border_image: `<border_image_source>||<border_image_slice>[/<border_image_width>|/<border_image_width>?/<border_image_outset>]?||<border_image_repeat>`,
    		border_image_source: `none|<image>`,
    		border_image_slice: `[<number>|<percentage>]{1,4}&&fill?`,
    		border_image_width: `[<length_percentage>|<number>|auto]{1,4}`,
    		border_image_outset: `[<length>|<number>]{1,4}`,
    		border_image_repeat: `[stretch|repeat|round|space]{1,2}`,
    		box_shadow: `none|<shadow>#`,
    		line_height: `normal|<percentage>|<length>|<number>`,
    		overflow: 'visible|hidden|scroll|auto',

    	/* https://www.w3.org/TR/css-fonts-4 */
    		font_display: "auto|block|swap|fallback|optional",
    		font_family: `[[<generic_family>|<family_name>],]*[<generic_family>|<family_name>]`,
    		font_language_override:"normal|<string>",
    		font: `[[<font_style>||<font_variant>||<font_weight>]?<font_size>[/<line_height>]?<font_family>]|caption|icon|menu|message-box|small-caption|status-bar`,
    		font_max_size: `<absolute_size>|<relative_size>|<length>|<percentage>|infinity`,
    		font_min_size: `<absolute_size>|<relative_size>|<length>|<percentage>`,
    		font_optical_sizing: `auto|none`,
    		font_pallette: `normal|light|dark|<identifier>`,
    		font_size: `<absolute_size>|<relative_size>|<length>|<percentage>`,
    		font_stretch:"<percentage>|normal|ultra-condensed|extra-condensed|condensed|semi-condensed|semi-expanded|expanded|extra-expanded|ultra-expanded",
    		font_style: `normal|italic|oblique<angle>?`,
    		font_synthesis:"none|[weight||style]",
    		font_synthesis_small_caps:"auto|none",
    		font_synthesis_style:"auto|none",
    		font_synthesis_weight:"auto|none",
    		font_variant_alternates:"normal|[stylistic(<feature-value-name>)||historical-forms||styleset(<feature-value-name>#)||character-variant(<feature-value-name>#)||swash(<feature-value-name>)||ornaments(<feature-value-name>)||annotation(<feature-value-name>)]",
    		font_variant_emoji:"auto|text|emoji|unicode",
    		font_variation_settings:" normal|[<string><number>]#",
    		font_size_adjust: `<number>|none`,
    		
    		font_weight: `normal|bold|bolder|lighter|100|200|300|400|500|600|700|800|900`,

    	/* https://www.w3.org/TR/css-fonts-3/ */
    		font_kerning: ` auto | normal | none`,
    		font_variant: `normal|none|[<common-lig-values>||<discretionary-lig-values>||<historical-lig-values>||<contextual-alt-values>||[small-caps|all-small-caps|petite-caps|all-petite-caps|unicase|titling-caps]||<numeric-figure-values>||<numeric-spacing-values>||<numeric-fraction-values>||ordinal||slashed-zero||<east-asian-variant-values>||<east-asian-width-values>||ruby||[sub|super]]`,
    		font_variant_ligatures:`normal|none|[<common-lig-values>||<discretionary-lig-values>||<historical-lig-values>||<contextual-alt-values> ]`,
    		font_variant_position:`normal|sub|super`,
    		font_variant_caps:`normal|small-caps|all-small-caps|petite-caps|all-petite-caps|unicase|titling-caps`,
    		font_variant_numeric: "normal | [ <numeric-figure-values> || <numeric-spacing-values> || <numeric-fraction-values> || ordinal || slashed-zero ]",
    		font_variant_east_asian:" normal | [ <east-asian-variant-values> || <east-asian-width-values> || ruby ]",

    	/* https://drafts.csswg.org/css-text-3 */
    		hanging_punctuation : "none|[first||[force-end|allow-end]||last]",
    		hyphens : "none|manual|auto",
    		letter_spacing: `normal|<length>`,
    		line_break : "auto|loose|normal|strict|anywhere",
    		overflow_wrap : "normal|break-word|anywhere",
    		tab_size : "<length>|<number>",
    		text_align : "start|end|left|right|center|justify|match-parent|justify-all",
    		text_align_all : "start|end|left|right|center|justify|match-parent",
    		text_align_last : "auto|start|end|left|right|center|justify|match-parent",
    		text_indent : "[[<length>|<percentage>]&&hanging?&&each-line?]",
    		text_justify : "auto|none|inter-word|inter-character",
    		text_transform : "none|[capitalize|uppercase|lowercase]||full-width||full-size-kana",
    		white_space : "normal|pre|nowrap|pre-wrap|break-spaces|pre-line",
    		word_break : " normal|keep-all|break-all|break-word",
    		word_spacing : "normal|<length>",
    		word_wrap : "  normal | break-word | anywhere",

    	/* https://drafts.csswg.org/css-text-decor-3 */
    		text_decoration: "<text-decoration-line>||<text-decoration-style>||<color>",
    		text_decoration_color:"<color>",
    		text_decoration_line:"none|[underline||overline||line-through||blink]",
    		text_decoration_style:"solid|double|dotted|dashed|wavy",
    		text_emphasis:"<text-emphasis-style>||<text-emphasis-color>",
    		text_emphasis_color:"<color>",
    		text_emphasis_position:"[over|under]&&[right|left]?",
    		text_emphasis_style:"none|[[filled|open]||[dot|circle|double-circle|triangle|sesame]]|<string>",
    		text_shadow:"none|[<color>?&&<length>{2,3}]#",
    		text_underline_position:"auto|[under||[left|right]]",

    	/* Flex Box https://www.w3.org/TR/css-flexbox-1/ */
    		align_content: `flex-start | flex-end | center | space-between | space-around | stretch`,
    		align_items: `flex-start | flex-end | center | baseline | stretch`,
    		align_self: `auto | flex-start | flex-end | center | baseline | stretch`,
    		flex:`none|[<flex-grow> <flex-shrink>?||<flex-basis>]`,
    		flex_basis:`content|<width>`,
    		flex_direction:`row | row-reverse | column | column-reverse`,
    		flex_flow:`<flex-direction>||<flex-wrap>`,
    		flex_grow:`<number>`,
    		flex_shrink:`<number>`,
    		flex_wrap:`nowrap|wrap|wrap-reverse`,
    		justify_content :"flex-start | flex-end | center | space-between | space-around",
    		order:`<integer>`,

    	/* https://drafts.csswg.org/css-transitions-1/ */
    		transition: `<single_transition>#`,
    		transition_delay: `<time>#`,
    		transition_duration: `<time>#`,
    		transition_property: `none|<single_transition_property>#`,
    		transition_timing_function: `<timing_function>#`,

    	/* CSS3 Animation https://drafts.csswg.org/css-animations-1/ */
    		animation: `<single_animation>#`,
    		animation_name: `[none|<keyframes_name>]#`,
    		animation_duration: `<time>#`,
    		animation_timing_function: `<timing_function>#`,
    		animation_iteration_count: `<single_animation_iteration_count>#`,
    		animation_direction: `<single_animation_direction>#`,
    		animation_play_state: `<single_animation_play_state>#`,
    		animation_delayed: `<time>#`,
    		animation_fill_mode: `<single_animation_fill_mode>#`,

    	/* https://svgwg.org/svg2-draft/interact.html#PointerEventsProperty */
    		pointer_events : `visiblePainted|visibleFill|visibleStroke|visible|painted|fill|stroke|all|none|auto`,

    	/* https://drafts.csswg.org/css-ui-3 */
    		caret_color :"auto|<color>",
    		cursor:"[[<url> [<number><number>]?,]*[auto|default|none|context-menu|help|pointer|progress|wait|cell|crosshair|text|vertical-text|alias|copy|move|no-drop|not-allowed|grab|grabbing|e-resize|n-resize|ne-resize|nw-resize|s-resize|se-resize|sw-resize|w-resize|ew-resize|ns-resize|nesw-resize|nwse-resize|col-resize|row-resize|all-scroll|zoom-in|zoom-out]]",
    		outline:"[<outline-color>||<outline-style>||<outline-width>]",
    		outline_color:"<color>|invert",
    		outline_offset:"<length>",
    		outline_style:"auto|<border-style>",
    		outline_width:"<line-width>",
    		resize:"none|both|horizontal|vertical",
    		text_overflow:"clip|ellipsis",

    	/* https://drafts.csswg.org/css-content-3/ */
    		bookmark_label:"<content-list>",
    		bookmark_level:"none|<integer>",
    		bookmark_state:"open|closed",
    		content:"normal|none|[<content-replacement>|<content-list>][/<string>]?",
    		quotes:"none|[<string><string>]+",
    		string_set:"none|[<custom-ident><string>+]#",
    	
    	/*https://www.w3.org/TR/CSS22/tables.html*/
    		caption_side:"top|bottom",
    		table_layout:"auto|fixed",
    		border_collapse:"collapse|separate",
    		border_spacing:"<length><length>?",
    		empty_cells:"show|hide",

    	/* https://www.w3.org/TR/CSS2/page.html */
    		page_break_before:"auto|always|avoid|left|right",
    		page_break_after:"auto|always|avoid|left|right",
    		page_break_inside:"auto|avoid|left|right",
    		orphans:"<integer>",
    		widows:"<integer>",

    	/* https://drafts.csswg.org/css-lists-3 */
    		counter_increment:"[<custom-ident> <integer>?]+ | none",
    		counter_reset:"[<custom-ident> <integer>?]+|none",
    		counter_set:"[<custom-ident> <integer>?]+|none",
    		list_style:"<list-style-type>||<list-style-position>||<list-style-image>",
    		list_style_image:"<url>|none",
    		list_style_position:"inside|outside",
    		list_style_type:"<counter-style>|<string>|none",
    		marker_side:"list-item|list-container",


    	vertical_align: `baseline|sub|super|top|text-top|middle|bottom|text-bottom|<percentage>|<length>`,

    	/* Visual Effects */
    	clip: '<shape>|auto',
    	visibility: `visible|hidden|collapse`,
    	content: `normal|none|[<string>|<uri>|<counter>|attr(<identifier>)|open-quote|close-quote|no-open-quote|no-close-quote]+`,
    	quotas: `[<string><string>]+|none`,
    	counter_reset: `[<identifier><integer>?]+|none`,
    	counter_increment: `[<identifier><integer>?]+|none`,
    };

    /* Properties that are not directly accessible by CSS prop creator */

    const virtual_property_definitions = {
        /* https://drafts.csswg.org/css-counter-styles-3 */
            /*system:`cyclic|numeric|alphabetic|symbolic|additive|[fixed<integer>?]|[extends<counter-style-name>]`,
            negative:`<symbol><symbol>?`,
            prefix:`<symbol>`,
            suffix:`<symbol>`,
            range:`[[<integer>|infinite]{2}]#|auto`,
            pad:`<integer>&&<symbol>`,
            fallback:`<counter-style-name>`
            symbols:`<symbol>+`,*/

            counter_style:`<numeric_counter_style>|<alphabetic_counter_style>|<symbolic_counter_style>|<japanese_counter_style>|<korean_counter_style>|<chinese_counter_style>|ethiopic-numeric`,
            numeric_counter_style:`decimal|decimal-leading-zero|arabic-indic|armenian|upper-armenian|lower-armenian|bengali|cambodian|khmer|cjk-decimal|devanagari|georgian|gujarati|gurmukhi|hebrew|kannada|lao|malayalam|mongolian|myanmar|oriya|persian|lower-roman|upper-roman|tamil|telugu|thai|tibetan`,
            symbolic_counter_style:`disc|circle|square|disclosure-open|disclosure-closed`,
            alphabetic_counter_style:`lower-alpha|lower-latin|upper-alpha|upper-latin|cjk-earthly-branch|cjk-heavenly-stem|lower-greek|hiragana|hiragana-iroha|katakana|katakana-iroha`,
            japanese_counter_style:`japanese-informal|japanese-formal`,
            korean_counter_style:`korean-hangul-formal|korean-hanja-informal|and korean-hanja-formal`,
            chinese_counter_style:`simp-chinese-informal|simp-chinese-formal|trad-chinese-informal|and trad-chinese-formal`,

    	/* https://drafts.csswg.org/css-content-3/ */
    		content_list:"[<string>|contents|<image>|<quote>|<target>|<leader()>]+",
    		content_replacement:"<image>",

    	/* https://drafts.csswg.org/css-values-4 */
    		custom_ident:"<identifier>",
    		position:"[[left|center|right]||[top|center|bottom]|[left|center|right|<length-percentage>][top|center|bottom|<length-percentage>]?|[[left|right]<length-percentage>]&&[[top|bottom]<length-percentage>]]",
    	
    	/* https://drafts.csswg.org/css-lists-3 */

    	east_asian_variant_values:"[jis78|jis83|jis90|jis04|simplified|traditional]",

    	alphavalue: '<number>',

    	box: `border-box|padding-box|content-box`,

    	/*Font-Size: www.w3.org/TR/CSS2/fonts.html#propdef-font-size */
    	absolute_size: `xx-small|x-small|small|medium|large|x-large|xx-large`,
    	relative_size: `larger|smaller`,

    	/*https://www.w3.org/TR/css-backgrounds-3/*/

    	bg_layer: `<bg_image>||<bg_position>[/<bg_size>]?||<repeat_style>||<attachment>||<box>||<box>`,
    	final_bg_layer: `<background_color>||<bg_image>||<bg_position>[/<bg_size>]?||<repeat_style>||<attachment>||<box>||<box>`,
    	bg_image: `<url>|<gradient>|none`,
    	repeat_style: `repeat-x|repeat-y|[repeat|space|round|no-repeat]{1,2}`,
    	background_attachment: `<attachment>#`,
    	bg_size: `<length_percentage>|auto]{1,2}|cover|contain`,
    	bg_position: `[[left|center|right|top|bottom|<length_percentage>]|[left|center|right|<length_percentage>][top|center|bottom|<length_percentage>]|[center|[left|right]<length_percentage>?]&&[center|[top|bottom]<length_percentage>?]]`,
    	attachment: `scroll|fixed|local`,
    	line_style: `none|hidden|dotted|dashed|solid|double|groove|ridge|inset|outset`,
    	line_width: `thin|medium|thick|<length>`,
    	shadow: `inset?&&<length>{2,4}&&<color>?`,

    	/* Font https://www.w3.org/TR/css-fonts-4/#family-name-value */
    	
    	family_name: `<fontname>`,
    	generic_family: `serif|sans-serif|cursive|fantasy|monospace`,
    	
    	/* Identifier https://drafts.csswg.org/css-values-4/ */

    	identifier: `<id>`,
    	custom_ident: `<id>`,

    	/* https://drafts.csswg.org/css-timing-1/#typedef-timing-function */

    	timing_function: `linear|<cubic_bezier_timing_function>|<step_timing_function>|<frames_timing_function>`,
    	cubic_bezier_timing_function: `<cubic_bezier>`,
    	step_timing_function: `step-start|step-end|'steps()'`,
    	frames_timing_function: `'frames()'`,

    	/* https://drafts.csswg.org/css-transitions-1/ */

    	single_animation_fill_mode: `none|forwards|backwards|both`,
    	single_animation_play_state: `running|paused`,
    	single_animation_direction: `normal|reverse|alternate|alternate-reverse`,
    	single_animation_iteration_count: `infinite|<number>`,
    	single_transition_property: `all|<custom_ident>`,
    	single_transition: `[none|<single_transition_property>]||<time>||<timing_function>||<time>`,

    	/* CSS3 Animation https://drafts.csswg.org/css-animations-1/ */

    	single_animation: `<time>||<timing_function>||<time>||<single_animation_iteration_count>||<single_animation_direction>||<single_animation_fill_mode>||<single_animation_play_state>||[none|<keyframes_name>]`,
    	keyframes_name: `<string>`,

    	/* CSS3 Stuff */
    	length_percentage: `<length>|<percentage>`,
    	frequency_percentage: `<frequency>|<percentage>`,
    	angle_percentage: `<angle>|<percentage>`,
    	time_percentage: `<time>|<percentage>`,
    	number_percentage: `<number>|<percentage>`,

    	/*CSS Clipping https://www.w3.org/TR/css-masking-1/#clipping */
    	clip_path: `<clip_source>|[<basic_shape>||<geometry_box>]|none`,
    	clip_source: `<url>`,
    	shape_box: `<box>|margin-box`,
    	geometry_box: `<shape_box>|fill-box|stroke-box|view-box`,
    	basic_shape: `<CSS_Shape>`,
    	ratio: `<integer>/<integer>`,

    	/* https://www.w3.org/TR/css-fonts-3/*/
    	common_lig_values        : `[ common-ligatures | no-common-ligatures ]`,
    	discretionary_lig_values : `[ discretionary-ligatures | no-discretionary-ligatures ]`,
    	historical_lig_values    : `[ historical-ligatures | no-historical-ligatures ]`,
    	contextual_alt_values    : `[ contextual | no-contextual ]`,

    	//Display
    	display_outside  : `block | inline | run-in`,
    	display_inside   : `flow | flow-root | table | flex | grid | ruby`,
    	display_listitem : `<display_outside>? && [ flow | flow-root ]? && list-item`,
    	display_internal : `table-row-group | table-header-group | table-footer-group | table-row | table-cell | table-column-group | table-column | table-caption | ruby-base | ruby-text | ruby-base-container | ruby-text-container`,
    	display_box      : `contents | none`,
    	display_legacy   : `inline-block | inline-table | inline-flex | inline-grid`,
    };

    const media_feature_definitions = {
    	width: "<m_width>",
    	min_width: "<m_max_width>",
    	max_width: "<m_min_width>",
    	height: "<m_height>",
    	min_height: "<m_min_height>",
    	max_height: "<m_max_height>",
    	orientation: "portrait  | landscape",
    	aspect_ratio: "<ratio>",
    	min_aspect_ratio: "<ratio>",
    	max_aspect_ratio: "<ratio>",
    	resolution: "<length>",
    	min_resolution: "<length>",
    	max_resolution: "<length>",
    	scan: "progressive|interlace",
    	grid: "",
    	monochrome: "",
    	min_monochrome: "<integer>",
    	max_monochrome: "<integer>",
    	color: "",
    	min_color: "<integer>",
    	max_color: "<integer>",
    	color_index: "",
    	min_color_index: "<integer>",
    	max_color_index: "<integer>",

    };

    /**
     * Used to _bind_ a rule to a CSS selector.
     * @param      {string}  selector        The raw selector string value
     * @param      {array}  selector_array  An array of selector group identifiers.
     * @memberof module:wick~internals.css
     * @alias CSSSelector
     */
    class CSSSelector$1 {

        constructor(value = "", value_array = []) {

            /**
             * The raw selector string value
             * @package
             */
            this.v = value;

            /**
             * Array of separated selector strings in reverse order.
             * @package
             */
            this.a = value_array;

            // CSS Rulesets the selector is member of .
            this.r = null;

            // CSS root the selector is a child of. 
            this.root = null;
        }

        get id() {
            return this.v.join("");
        }
        /**
         * Returns a string representation of the object.
         * @return     {string}  String representation of the object.
         */
        toString(off = 0) {
            let offset = ("    ").repeat(off);

            let str = `${offset}${this.v.join(", ")} {\n`;

            if (this.r)
                str += this.r.toString(off + 1);

            return str + `${offset}}\n`;
        }

        addProp(string) {
            let root = this.r.root;
            if (root) {
                let lex = whind$1(string);
                while (!lex.END)
                    root.parseProperty(lex, this.r, property_definitions);
            }
        }

        removeRule(){
            if(this.r)
                this.r.decrementRef();

            this.r = null;
        }

        addRule(rule = null){
            
            this.removeRule();

            if(rule !== null)
                rule.incrementRef();

            this.r = rule;
        }

    }

    /**
     * Holds a set of rendered CSS properties.
     * @memberof module:wick~internals.css
     * @alias CSSRule
     */
    class CSSRule$1 {
        constructor(root) {
            /**
             * Collection of properties held by this rule.
             * @public
             */
            this.props = {};
            this.LOADED = false;
            this.root = root;

            //Reference Counting
            this.refs = 0;

            //Versioning
            this.ver = 0;
        }

        incrementRef(){
            this.refs++;
        }

        decrementRef(){
            this.refs--;
            if(this.refs <= 0){
                //TODO: remove from rules entries.
                debugger
            }
        }

        addProperty(prop, rule) {
            if (prop)
                this.props[prop.name] = prop.value;
        }



        toString(off = 0, rule = "") {
            let str = [],
                offset = ("    ").repeat(off);

            if (rule) {
                if (this.props[rule]) {
                    if (Array.isArray(this.props[rule]))
                        str.push(this.props[rule].join(" "));
                    else
                        str.push(this.props[rule].toString());
                }else
                    return "";
            } else {
                for (let a in this.props) {
                    if (this.props[a] !== null) {
                        if (Array.isArray(this.props[a]))
                            str.push(offset, a.replace(/\_/g, "-"), ":", this.props[a].join(" "), ";\n");
                        else
                            str.push(offset, a.replace(/\_/g, "-"), ":", this.props[a].toString(), ";\n");
                    }
                }
            }

            return str.join(""); //JSON.stringify(this.props).replace(/\"/g, "").replace(/\_/g, "-");
        }

        merge(rule) {
            if (rule.props) {
                for (let n in rule.props)
                    this.props[n] = rule.props[n];
                this.LOADED = true;
                this.ver++;
            }
        }

        get _wick_type_() { return 0; }

        set _wick_type_(v) {}
    }

    function checkDefaults(lx) {
        const tx = lx.tx;
        /* https://drafts.csswg.org/css-cascade/#inherited-property */
        switch (lx.tx) {
            case "initial": //intentional
            case "inherit": //intentional
            case "unset": //intentional
            case "revert": //intentional
                if (!lx.pk.pk.END) // These values should be the only ones present. Failure otherwise.
                    return 0; // Default value present among other values. Invalid
                return 1; // Default value present only. Valid
        }    return 2; // Default value not present. Ignore
    }

    class JUX { /* Juxtaposition */

        constructor() {
            this.id = JUX.step++;
            this.r = [NaN, NaN];
            this.terms = [];
            this.prop = null;
            this.name = "";
            this.virtual = false;
            this.REQUIRE_COMMA = false;
        }
        mergeValues(existing_v, new_v) {
            if (existing_v)
                if (existing_v.v) {
                    if (Array.isArray(existing_v.v))
                        existing_v.v.push(new_v.v);
                    else {
                        existing_v.v = [existing_v.v, new_v.v];
                    }
                } else
                    existing_v.v = new_v.v;
        }

        seal() {

        }

        sp(value, rule) { /* Set Property */
            if (this.prop) {
                if (value)
                    if (Array.isArray(value) && value.length === 1 && Array.isArray(value[0]))
                        rule[this.prop] = value[0];
                    else
                        rule[this.prop] = value;
            }
        }

        isRepeating() {
            return !(isNaN(this.r[0]) && isNaN(this.r[1]));
        }

        parse(lx, rule, out_val, ROOT = true) {
                
            if (typeof(lx) == "string")
                lx = whind$1(lx);

            let r = out_val || { v: null },
                bool = false;

            if (ROOT) {
                switch (checkDefaults(lx)) {
                    case 1:
                        this.sp(lx.tx, rule);
                        return true;
                    case 0:
                        return false;
                }

                bool = this.innerParser(lx, rule, out_val, r, this.start, this.end);

                //if (!lx.END)
                //    return false;
                //else
                    this.sp(r.v, rule);
            } else
                bool = this.innerParser(lx, rule, out_val, r, this.start, this.end);

            return bool;
        }

        checkForComma(lx) {
            if (this.REQUIRE_COMMA) {
                if (lx.ch == ",")
                    lx.next();
                else return false;
            }
            return true;
        }

        innerParser(lx, rule, out_val, r, start, end) {

            let bool = false;

            repeat:
                for (let j = 0; j < end && !lx.END; j++) {
                    let copy = lx.copy();
                    let temp_r = { v: null };

                    for (let i = 0, l = this.terms.length; i < l; i++) {

                        let term = this.terms[i];

                        if (!term.parse(copy, rule, temp_r, false)) {
                            if (!term.OPTIONAL) {
                                break repeat;
                            }
                        }
                    }

                    if (temp_r.v)
                        this.mergeValues(r, temp_r);

                    lx.sync(copy);

                    bool = true;

                    if (!this.checkForComma(lx))
                        break;
                }

            if (bool)
                //console.log("JUX", s, bool)
                return bool;
        }

        get start() {
            return isNaN(this.r[0]) ? 1 : this.r[0];
        }
        set start(e) {}

        get end() {
            return isNaN(this.r[1]) ? 1 : this.r[1];
        }
        set end(e) {}

        get OPTIONAL() { return this.r[0] === 0 }
        set OPTIONAL(a) {}
    }
    JUX.step = 0;
    class AND extends JUX {
        innerParser(lx, rule, out_val, r, start, end) {

            const
                PROTO = new Array(this.terms.length),
                l = this.terms.length;

            let bool = false;

            repeat:
                for (let j = 0; j < end && !lx.END; j++) {

                    const
                        HIT = PROTO.fill(0),
                        copy = lx.copy(),
                        temp_r = { v: null };

                    and:
                        while (true) {



                            for (let i = 0; i < l; i++) {

                                if (HIT[i] === 2) continue;

                                let term = this.terms[i];

                                if (!term.parse(copy, rule, temp_r, false)) {
                                    if (term.OPTIONAL)
                                        HIT[i] = 1;
                                } else {
                                    HIT[i] = 2;
                                    continue and;
                                }
                            }

                            if (HIT.reduce((a, v) => a * v, 1) === 0)
                                break repeat;

                            break
                        }



                    lx.sync(copy);

                    if (temp_r.v)
                        this.mergeValues(r, temp_r);

                    bool = true;

                    if (!this.checkForComma(lx))
                        break;
                }

            return bool;
        }
    }

    class OR extends JUX {
        innerParser(lx, rule, out_val, r, start, end) {

            const
                PROTO = new Array(this.terms.length),
                l = this.terms.length;

            let
                bool = false,
                NO_HIT = true;

            repeat:
                for (let j = 0; j < end && !lx.END; j++) {

                    const HIT = PROTO.fill(0);
                    let copy = lx.copy();
                    let temp_r = { v: null };

                    or:
                        while (true) {
                            for (let i = 0; i < l; i++) {

                                if (HIT[i] === 2) continue;

                                let term = this.terms[i];

                                if (term.parse(copy, temp_r, r, false)) {
                                    NO_HIT = false;
                                    HIT[i] = 2;
                                    continue or;
                                }
                            }

                            if (NO_HIT) break repeat;

                            break;
                        }

                    lx.sync(copy);

                    if (temp_r.v)
                        this.mergeValues(r, temp_r);

                    bool = true;

                    if (!this.checkForComma(lx))
                        break;
                }

            return bool;
        }
    }

    OR.step = 0;

    class ONE_OF extends JUX {
        innerParser(lx, rule, out_val, r, start, end) {

            let BOOL = false;

            let j;
            for (j = 0; j < end && !lx.END; j++) {
                let bool = false;
                let copy = lx.copy();
                let temp_r = { v: null };

                for (let i = 0, l = this.terms.length; i < l; i++) {
                    ////if (!this.terms[i]) console.log(this)
                    if (this.terms[i].parse(copy, rule, temp_r, false)) {
                        bool = true;
                        break;
                    }
                }

                if (!bool)
                    break;

                lx.sync(copy);
                
                if (temp_r.v)
                    this.mergeValues(r, temp_r);

                BOOL = true;

                if (!this.checkForComma(lx))
                    break;
            }

            return BOOL;
        }
    }

    ONE_OF.step = 0;

    class ValueTerm {

        constructor(value, getPropertyParser, definitions, productions) {

            if(value instanceof JUX)
                return value;
            

            this.value = null;

            const IS_VIRTUAL = { is: false };
            
            if(typeof(value) == "string")
                var u_value = value.replace(/\-/g,"_");

            if (!(this.value = types[u_value]))
                this.value = getPropertyParser(u_value, IS_VIRTUAL, definitions, productions);

            this.prop = "";

            if (!this.value)
                return new LiteralTerm(value);

            if(this.value instanceof JUX){
                if (IS_VIRTUAL.is)
                    this.value.virtual = true;
                return this.value;
            }

        }

        seal(){}

        parse(l, rule, r, ROOT = true) {
            if (typeof(l) == "string")
                l = whind$1(l);

            if (ROOT) {

                switch(checkDefaults(l)){
                    case 1:
                    rule[this.prop] = l.tx;
                    return true;
                    case 0:
                    return false;
                }
            }

            let rn = { v: null };

            let v = this.value.parse(l, rule, rn);

            if (rn.v) {
                if (r)
                    if (r.v) {
                        if (Array.isArray(r.v)) {
                            if (Array.isArray(rn.v) && !this.virtual)
                                r.v = r.v.concat(rn.v);
                            else
                                r.v.push(rn.v);
                        } else {
                            if (Array.isArray(rn.v) && !this.virtual)
                                r.v = ([r.v]).concat(rn.v);
                            else
                                r.v = [r.v, rn.v];
                        }
                    } else
                        r.v = (this.virtual) ? [rn.v] : rn.v;

                if (this.prop && !this.virtual)
                    rule[this.prop] = rn.v;

                return true;

            } else if (v) {
                if (r)
                    if (r.v) {
                        if (Array.isArray(r.v))
                            r.v.push(v);
                        else
                            r.v = [r.v, v];
                    } else
                        r.v = v;

                if (this.prop && !this.virtual && ROOT)
                    rule[this.prop] = v;

                return true;
            } else
                return false;
        }

        get OPTIONAL (){ return false }
        set OPTIONAL (a){}
    }

    class LiteralTerm {

        constructor(value, type) {
            
            if(type == whind$1.types.string)
                value = value.slice(1,-1);

            this.value = value;
            this.prop = null;
        }

        seal(){}

        parse(l, rule, r, root = true) {

            if (typeof(l) == "string")
                l = whind$1(l);

            if (root) {
                switch(checkDefaults(l)){
                    case 1:
                    rule[this.prop] = l.tx;
                    return true;
                    case 0:
                    return false;
                }
            }

            let v = l.tx;
            if (v == this.value) {
                l.next();

                if (r)
                    if (r.v) {
                        if (Array.isArray(r.v))
                            r.v.push(v);
                        else {
                            let t = r.v;
                            r.v = [t, v];
                        }
                    } else
                        r.v = v;

                if (this.prop  && !this.virtual && root)
                    rule[this.prop] = v;

                return true;
            }
            return false;
        }

        get OPTIONAL (){ return false }
        set OPTIONAL (a){}
    }

    class SymbolTerm extends LiteralTerm {
        parse(l, rule, r) {
            if (typeof(l) == "string")
                l = whind$1(l);

            if (l.tx == this.value) {
                l.next();
                return true;
            }

            return false;
        }
    }

    //import util from "util"
    const standard_productions = {
        JUX,
        AND,
        OR,
        ONE_OF,
        LiteralTerm,
        ValueTerm,
        SymbolTerm
    };
    function getPropertyParser(property_name, IS_VIRTUAL = { is: false }, definitions = null, productions = standard_productions) {

        let prop = definitions[property_name];

        if (prop) {

            if (typeof(prop) == "string") {
                prop = definitions[property_name] = CreatePropertyParser(prop, property_name, definitions, productions);
            }
            prop.name = property_name;
            return prop;
        }

        if (!definitions.__virtual)
            definitions.__virtual = Object.assign({}, virtual_property_definitions);

        prop = definitions.__virtual[property_name];

        if (prop) {

            IS_VIRTUAL.is = true;

            if (typeof(prop) == "string") {
                prop = definitions.__virtual[property_name] = CreatePropertyParser(prop, "", definitions, productions);
                prop.virtual = true;
                prop.name = property_name;
            }

            return prop;
        }

        return null;
    }


    function CreatePropertyParser(notation, name, definitions, productions) {

        const l = whind$1(notation);
        const important = { is: false };

        let n = d$1(l, definitions, productions);
        
        n.seal();

        //if (n instanceof productions.JUX && n.terms.length == 1 && n.r[1] < 2)
        //    n = n.terms[0];

        n.prop = name;
        n.IMP = important.is;

        /*//******** DEV 
        console.log("")
        console.log("")
        console.log(util.inspect(n, { showHidden: false, depth: null })) 
        //********** END Dev*/

        return n;
    }

    function d$1(l, definitions, productions, super_term = false, oneof_group = false, or_group = false, and_group = false, important = null) {
        let term, nt, v;
        const { JUX: JUX$$1, AND: AND$$1, OR: OR$$1, ONE_OF: ONE_OF$$1, LiteralTerm: LiteralTerm$$1, ValueTerm: ValueTerm$$1, SymbolTerm: SymbolTerm$$1 } = productions;

        while (!l.END) {

            switch (l.ch) {
                case "]":
                    return term;
                    break;
                case "[":

                    v = d$1(l.next(), definitions, productions, true);
                    l.assert("]");
                    v = checkExtensions(l, v, productions);

                    if (term) {
                        if (term instanceof JUX$$1 && term.isRepeating()) term = foldIntoProduction(productions, new JUX$$1, term);
                        term = foldIntoProduction(productions, term, v);
                    } else
                        term = v;
                    break;

                case "<":

                    v = new ValueTerm$$1(l.next().tx, getPropertyParser, definitions, productions);
                    l.next().assert(">");

                    v = checkExtensions(l, v, productions);

                    if (term) {
                        if (term instanceof JUX$$1 /*&& term.isRepeating()*/) term = foldIntoProduction(productions, new JUX$$1, term);
                        term = foldIntoProduction(productions, term, v);
                    } else {
                        term = v;
                    }
                    break;

                case "&":

                    if (l.pk.ch == "&") {

                        if (and_group)
                            return term;

                        nt = new AND$$1();

                        if (!term) throw new Error("missing term!");

                        nt.terms.push(term);

                        l.sync().next();

                        while (!l.END) {
                            nt.terms.push(d$1(l, definitions, productions, super_term, oneof_group, or_group, true, important));
                            if (l.ch !== "&" || l.pk.ch !== "&") break;
                            l.a("&").a("&");
                        }

                        return nt;
                    }
                    break;
                case "|":

                    {
                        if (l.pk.ch == "|") {

                            if (or_group || and_group)
                                return term;

                            nt = new OR$$1();

                            nt.terms.push(term);

                            l.sync().next();

                            while (!l.END) {
                                nt.terms.push(d$1(l, definitions, productions, super_term, oneof_group, true, and_group, important));
                                if (l.ch !== "|" || l.pk.ch !== "|") break;
                                l.a("|").a("|");
                            }

                            return nt;

                        } else {

                            if (oneof_group || or_group || and_group)
                                return term;

                            nt = new ONE_OF$$1();

                            nt.terms.push(term);

                            l.next();

                            while (!l.END) {
                                nt.terms.push(d$1(l, definitions, productions, super_term, true, or_group, and_group, important));
                                if (l.ch !== "|") break;
                                l.a("|");
                            }

                            return nt;
                        }
                    }
                    break;
                default:

                    v = (l.ty == l.types.symbol) ? new SymbolTerm$$1(l.tx) : new LiteralTerm$$1(l.tx, l.ty);
                    l.next();
                    v = checkExtensions(l, v, productions);

                    if (term) {
                        if (term instanceof JUX$$1 /*&& (term.isRepeating() || term instanceof ONE_OF)*/) term = foldIntoProduction(productions, new JUX$$1, term);
                        term = foldIntoProduction(productions, term, v);
                    } else {
                        term = v;
                    }
            }
        }

        return term;
    }

    function checkExtensions(l, term, productions) {
        outer:
        while (true) {

            switch (l.ch) {
                case "!":
                    /* https://www.w3.org/TR/CSS21/cascade.html#important-rules */
                    term.IMPORTANT = true;
                    l.next();
                    continue outer;
                case "{":
                    term = foldIntoProduction(productions, term);
                    term.r[0] = parseInt(l.next().tx);
                    if (l.next().ch == ",") {
                        l.next();
                        if (l.pk.ch == "}") {

                            term.r[1] = parseInt(l.tx);
                            l.next();
                        } else {
                            term.r[1] = Infinity;
                        }
                    } else
                        term.r[1] = term.r[0];
                    l.a("}");
                    break;
                case "*":
                    term = foldIntoProduction(productions, term);
                    term.r[0] = 0;
                    term.r[1] = Infinity;
                    l.next();
                    break;
                case "+":
                    term = foldIntoProduction(productions, term);
                    term.r[0] = 1;
                    term.r[1] = Infinity;
                    l.next();
                    break;
                case "?":
                    term = foldIntoProduction(productions, term);
                    term.r[0] = 0;
                    term.r[1] = 1;
                    l.next();
                    break;
                case "#":
                    term = foldIntoProduction(productions, term);
                    term.terms.push(new SymbolTerm(","));
                    term.r[0] = 1;
                    term.r[1] = Infinity;
                    term.REQUIRE_COMMA = true;
                    l.next();
                    if (l.ch == "{") {
                        term.r[0] = parseInt(l.next().tx);
                        term.r[1] = parseInt(l.next().a(",").tx);
                        l.next().a("}");
                    }
                    break;
            }
            break;
        }
        return term;
    }

    function foldIntoProduction(productions, term, new_term = null) {
        if (term) {
            if (!(term instanceof productions.JUX)) {
                let nr = new productions.JUX();
                nr.terms.push(term);
                term = nr;
            }
            if (new_term) {
                term.seal();
                term.terms.push(new_term);
            }
            return term;
        }
        return new_term;
    }

    /**
     * Checks to make sure token is an Identifier.
     * @param      {Lexer} - A Lexical tokenizing object supporting methods found in {@link Lexer}.
     * @alias module:wick~internals.css.elementIsIdentifier
     */
    function _eID_(lexer) {
        if (lexer.ty != lexer.types.id) lexer.throw("Expecting Identifier");
    }

    /**
     * The empty CSSRule instance
     * @alias module:wick~internals.css.empty_rule
     */
    const er = Object.freeze(new CSSRule$1());

    class _selectorPart_ {
        constructor() {
            this.e = "";
            this.ss = [];
            this.c = "";
        }
    }
    class _mediaSelectorPart_ {
        constructor() {
            this.id = "";
            this.props = {};
            this.c = "";
        }
    }

    class CSSRuleBody {
        
        constructor() {

            // 
            this.media_selector = null;
            
            // All selectors indexed by their value
            this._selectors_ = {};

            //All selectors in order of appearance
            this._sel_a_ = [];

            //
            this.rules = []; 
        }

        _applyProperties_(lexer, rule) {
            while (!lexer.END && lexer.tx !== "}") this.parseProperty(lexer, rule, property_definitions);
            lexer.next();
        }

        /**
         * Gets the last rule matching the selector
         * @param      {string}  string  The string
         * @return     {CSSRule}  The combined set of rules that match the selector.
         */
        getRule(string, r) {
            let selector = this._selectors_[string];
            if (selector) return selector.r;
            return r;
        }


        /**
         * Hook method for hijacking the property parsing function. Return true if default property parsing should not take place
         * @param      {Lexer}   value_lexer    The value lexer
         * @param      {<type>}   property_name  The property name
         * @param      {<type>}   rule           The rule
         * @return     {boolean}  The property hook.
         */
        _getPropertyHook_(value_lexer, property_name, rule) {
            return false;
        }

        /**
         * Used to match selectors to elements
         * @param      {ele}   ele       The ele
         * @param      {string}   criteria  The criteria
         * @return     {boolean}  { description_of_the_return_value }
         * @private
         */
        matchCriteria(ele, criteria) {
            if (criteria.e && ele.tagName !== criteria.e.toUpperCase()) return false;
            outer: for (let i = 0, l = criteria.ss.length; i < l; i++) {
                let ss = criteria.ss[i];
                switch (ss.t) {
                    case "attribute":
                        let lex = whind$1(ss.v);
                        if (lex.ch == "[" && lex.pk.ty == lex.types.id) {
                            let id = lex.sync().tx;
                            let attrib = ele.getAttribute(id);
                            if (!attrib) return;
                            if (lex.next().ch == "=") {
                                let value = lex.next().tx;
                                if (attrib !== value) return false;
                            }
                        }
                        break;
                    case "pseudo":
                        debugger;
                        break;
                    case "class":
                        let class_list = ele.classList;
                        for (let j = 0, jl = class_list.length; j < jl; j++) {
                            if (class_list[j] == ss.v) continue outer;
                        }
                        return false;
                    case "id":
                        if (ele.id !== ss.v) return false;
                }
            }
            return true;
        }

        matchMedia(win = window) {

            if (this.media_selector) {
                for (let i = 0; i < this.media_selector.length; i++) {
                    let m = this.media_selector[i];
                    let props = m.props;
                    for (let a in props) {
                        let prop = props[a];
                        if (!prop(win))
                            return false;
                    }
                }        }

            return true;
        }

        
        /* 
            Retrieves the set of rules from all matching selectors for an element.
                element HTMLElement - An DOM element that should be matched to applicable rules. 
        */
        getApplicableRules(element, rule = new CSSRule$1(), win = window) {

            if (!this.matchMedia(win)) return;

            let gen = this.getApplicableSelectors(element),
                sel = null;

            while (sel = gen.next().value) rule.merge(sel.r);
        }

        * getApplicableSelectors(element) {
            for (let j = 0, jl = this._sel_a_.length; j < jl; j++) {
                let ancestor = element;
                let selector = this._sel_a_[j];
                let sn = selector.a;
                let criteria = null;
                outer: for (let x = 0; x < sn.length; x++) {

                    let sa = sn[x];

                    inner: for (let i = 0, l = sa.length; i < l; i++) {
                        criteria = sa[i];
                        switch (criteria.c) {
                            case "child":
                                if (!(ancestor = ancestor.parentElement) || !this.matchCriteria(ancestor, criteria)) continue outer;
                                break;
                            case "preceded":
                                while ((ancestor = ancestor.previousElementSibling))
                                    if (this.matchCriteria(ancestor, criteria)) continue inner;
                                continue outer;
                            case "immediately preceded":
                                if (!(ancestor = ancestor.previousElementSibling) || !this.matchCriteria(ancestor, criteria)) continue outer;
                                break;
                            case "descendant":
                                while ((ancestor = ancestor.parentElement))
                                    if (this.matchCriteria(ancestor, criteria)) continue inner;
                                continue outer;
                            default:
                                if (!this.matchCriteria(ancestor, criteria)) continue outer;
                        }
                    }
                    yield selector;
                }
            }
        }

        /**
         * Parses properties
         * @param      {Lexer}  lexer        The lexer
         * @param      {<type>}  rule         The rule
         * @param      {<type>}  definitions  The definitions
         */
        parseProperty(lexer, rule, definitions) {
            const name = lexer.tx.replace(/\-/g, "_");

            //Catch any comments
            if (lexer.ch == "/") {
                lexer.comment(true);
                let bool = this.parseProperty(lexer, rule, definitions);
                return 
            }
            lexer.next().a(":");
            //allow for short circuit < | > | =
            const p = lexer.pk;
            while ((p.ch !== "}" && p.ch !== ";") && !p.END) {
                //look for end of property;
                p.next();
            }
            const out_lex = lexer.copy();
            lexer.sync();
            out_lex.fence(p);
            if (!this._getPropertyHook_(out_lex, name, rule)) {
                try {
                    const IS_VIRTUAL = {
                        is: false
                    };
                    const parser = getPropertyParser(name, IS_VIRTUAL, definitions);
                    if (parser && !IS_VIRTUAL.is) {
                        if (!rule.props) rule.props = {};
                        parser.parse(out_lex, rule.props);
                    } else
                        //Need to know what properties have not been defined
                        console.warn(`Unable to get parser for css property ${name}`);
                } catch (e) {
                    console.log(e);
                }
            }
            if (lexer.ch == ";") lexer.next();
        }

        /** 
        Parses a selector up to a token '{', creating or accessing necessary rules as it progresses. 

        Reference: https://www.w3.org/TR/selectors-3/ 
        https://www.w3.org/TR/css3-mediaqueries/
        https://www.w3.org/TR/selectors-3/

        @param {Lexer} - A Lexical tokenizing object supporting methods found in {@link Lexer}.

        @protected

        */
        parseSelector(lexer) {
            let selector_array = [],
                selectors_array = [];
            let start = lexer.pos;
            let selectors = [];
            let sel = new _selectorPart_(),
                RETURN = false;
            while (!lexer.END) {
                if (!sel) sel = new _selectorPart_();
                switch (lexer.tx) {
                    case "{":
                        RETURN = true;
                    case ",":
                        selector_array.unshift(sel);
                        selectors_array.push(selector_array);
                        selector_array = [];
                        selectors.push(lexer.s(start).trim().slice(0));
                        sel = new _selectorPart_();
                        if (RETURN) return new CSSSelector$1(selectors, selectors_array, this);
                        lexer.next();
                        start = lexer.pos;
                        break;
                    case "[":
                        let p = lexer.pk;
                        while (!p.END && p.next().tx !== "]") {}                    p.a("]");
                        if (p.END) throw new _Error_("Unexpected end of input.");
                        sel.ss.push({
                            t: "attribute",
                            v: p.s(lexer)
                        });
                        lexer.sync();
                        break;
                    case ":":
                        sel.ss.push({
                            t: "pseudo",
                            v: lexer.next().tx
                        });
                        _eID_(lexer);
                        lexer.next();
                        break;
                    case ".":
                        sel.ss.push({
                            t: "class",
                            v: lexer.next().tx
                        });
                        _eID_(lexer);
                        lexer.next();
                        break;
                    case "#":
                        sel.ss.push({
                            t: "id",
                            v: lexer.next().tx
                        });
                        _eID_(lexer);
                        lexer.next();
                        break;
                    case "*":
                        lexer.next();
                        break;
                    case ">":
                        sel.c = "child";
                        selector_array.unshift(sel);
                        sel = null;
                        lexer.next();
                        break;
                    case "~":
                        sel.c = "preceded";
                        selector_array.unshift(sel);
                        sel = null;
                        lexer.next();
                        break;
                    case "+":
                        sel.c = "immediately preceded";
                        selector_array.unshift(sel);
                        sel = null;
                        lexer.next();
                        break;
                    default:
                        if (sel.e) {
                            sel.c = "descendant";
                            selector_array.unshift(sel);
                            sel = null;
                        } else {
                            sel.e = lexer.tx;

                            _eID_(lexer);
                            lexer.next();
                        }
                        break;
                }
            }

            selector_array.unshift(sel);
            selectors_array.push(selector_array);
            selectors.push(lexer.s(start).trim().slice(0));
            return new CSSSelector$1(selectors, selectors_array, this);
        }

        /**
         * Parses CSS string
         * @param      {Lexer} - A Lexical tokenizing object supporting methods found in {@link Lexer}
         * @param      {(Array|CSSRuleBody|Object|_mediaSelectorPart_)}  root    The root
         * @return     {Promise}  A promise which will resolve to a CSSRuleBody
         * @private
         */
        parse(lexer, root, res = null, rej = null) {

            if (root && !this.par) root.push(this);

            return new Promise((res, rej) => {
                
                let selectors = [], l = 0;
                
                while (!lexer.END) {
                    switch (lexer.ch) {
                        case "@":
                            lexer.next();
                            switch (lexer.tx) {
                                case "media": //Ignored at this iteration /* https://drafts.csswg.org/mediaqueries/ */
                                    //create media query selectors
                                    let _med_ = [],
                                        sel = null;
                                    while (!lexer.END && lexer.next().ch !== "{") {
                                        if (!sel) sel = new _mediaSelectorPart_();
                                        if (lexer.ch == ",") _med_.push(sel), sel = null;
                                        else if (lexer.ch == "(") {
                                            let start = lexer.next().off;
                                            while (!lexer.END && lexer.ch !== ")") lexer.next();
                                            let out_lex = lexer.copy();
                                            out_lex.off = start;
                                            out_lex.tl = 0;
                                            out_lex.next().fence(lexer);
                                            this.parseProperty(out_lex, sel, media_feature_definitions);
                                            if (lexer.pk.tx.toLowerCase() == "and") lexer.sync();
                                        } else {
                                            let id = lexer.tx.toLowerCase(),
                                                condition = "";
                                            if (id === "only" || id === "not")
                                                (condition = id, id = lexer.next().tx);
                                            sel.c = condition;
                                            sel.id = id;
                                            if (lexer.pk.tx.toLowerCase() == "and") lexer.sync();
                                        }
                                    }
                                    //debugger
                                    lexer.a("{");
                                    if (sel)
                                        _med_.push(sel);

                                    if (_med_.length == 0)
                                        this.parse(lexer, null); // discard results
                                    else {
                                        let media_root = new this.constructor();
                                        media_root.media_selector = _med_;
                                        res(media_root.parse(lexer, root).then(b => {
                                            let body = new this.constructor();
                                            return body.parse(lexer, root);
                                        }));
                                    }
                                    continue;
                                case "import":
                                    /* https://drafts.csswg.org/css-cascade/#at-ruledef-import */
                                    let type;
                                    if (type = types.url.parse(lexer.next())) {
                                        lexer.a(";");
                                        /**
                                         * The {@link CSS_URL} incorporates a fetch mechanism that returns a Promise instance.
                                         * We use that promise to hook into the existing promise returned by CSSRoot#parse,
                                         * executing a new parse sequence on the fetched string data using the existing CSSRoot instance,
                                         * and then resume the current parse sequence.
                                         * @todo Conform to CSS spec and only parse if @import is at the head of the CSS string.
                                         */
                                        return type.fetchText().then((str) =>
                                            //Successfully fetched content, proceed to parse in the current root.
                                            //let import_lexer = ;
                                            res(this.parse(whind$1(str), this).then((r) => this.parse(lexer, r)))
                                            //parse returns Promise. 
                                            // return;
                                        ).catch((e) => res(this.parse(lexer)));
                                    } else {
                                        //Failed to fetch resource, attempt to find the end to of the import clause.
                                        while (!lexer.END && lexer.next().tx !== ";") {}                                    lexer.next();
                                    }
                            }
                            break;
                        case "/":
                            lexer.comment(true);
                            break;
                        case "}":
                            lexer.next();
                            return res(this);
                        case "{":
                            //Check to see if a rule body for the selector exists already.
                            let MERGED = false;
                            let rule = new CSSRule$1(this);
                            this._applyProperties_(lexer.next(), rule);
                            for (let i = -1, sel = null; sel = selectors[++i];)
                                if (sel.r) {sel.r.merge(rule); MERGED = true;}
                                else sel.addRule(rule);

                            if(!MERGED){
                                this.rules.push(rule);
                            }
                                
                            selectors.length = l = 0;
                            continue;
                    }

                    let selector = this.parseSelector(lexer, this);

                    if (selector) {
                        selector.root = this;
                        if (!this._selectors_[selector.id]) {
                            l = selectors.push(selector);
                            this._selectors_[selector.id] = selector;
                            this._sel_a_.push(selector);
                        } else l = selectors.push(this._selectors_[selector.id]);
                    }
                }

                return res(this);
            });

        }

        isSame(inCSSRuleBody) {
            if (inCSSRuleBody instanceof CSSRuleBody) {
                if (this.media_selector) {
                    if (inCSSRuleBody.media_selector) ;
                } else if (!inCSSRuleBody.media_selector)
                    return true;
            }
            return false;
        }

        merge(inCSSRuleBody) {
            this.parse(whind$1(inCSSRuleBody + ""));
        }

        /**
         * Gets the media.
         * @return     {Object}  The media.
         * @public
         */
        getMedia(win = window) {
            let start = this;
            this._media_.forEach((m) => {
                if (m._med_) {
                    let accept = true;
                    for (let i = 0, l = m._med_.length; i < l; i++) {
                        let ms = m._med_[i];
                        if (ms.props) {
                            for (let n in ms.props) {
                                if (!ms.props[n](win)) accept = false;
                            }
                        }
                        //if(not)
                        //    accept = !accept;
                        if (accept)
                            (m._next_ = start, start = m);
                    }
                }
            });
            return start;
        }

        updated() {
            this.par.updated();
        }

        toString(off = 0) {
            let str = "";
            for (let i = 0; i < this._sel_a_.length; i++) {
                str += this._sel_a_[i].toString(off);
            }
            return str;
        }

        createSelector(selector_value) {
            let selector = this.parseSelector(whind$1(selector_value));

            if (selector)
                if (!this._selectors_[selector.id]) {
                    this._selectors_[selector.id] = selector;
                    this._sel_a_.push(selector);
                    const rule = new CSSRule$1(this);
                    selector.addRule(rule);
                    this.rules.push(rule);
                } else
                    selector = this._selectors_[selector.id];

            return selector;
        }
    }

    LinkedList.mixinTree(CSSRuleBody);

    function checkDefaults$1(lx) {
        const tx = lx.tx;
        /* https://drafts.csswg.org/css-cascade/#inherited-property */
        switch (lx.tx) {
            case "initial": //intentional
            case "inherit": //intentional
            case "unset": //intentional
            case "revert": //intentional
                if (!lx.pk.pk.END) // These values should be the only ones present. Failure otherwise.
                    return 0; // Default value present among other values. Invalid
                return 1; // Default value present only. Valid
        }    return 2; // Default value not present. Ignore
    }

    class JUX$1 { /* Juxtaposition */

        constructor() {
            this.id = JUX$1.step++;
            this.r = [NaN, NaN];
            this.terms = [];
            this.prop = null;
            this.name = "";
            this.virtual = false;
            this.REQUIRE_COMMA = false;
        }
        mergeValues(existing_v, new_v) {
            if (existing_v)
                if (existing_v.v) {
                    if (Array.isArray(existing_v.v))
                        existing_v.v.push(new_v.v);
                    else {
                        existing_v.v = [existing_v.v, new_v.v];
                    }
                } else
                    existing_v.v = new_v.v;
        }

        seal() {

        }

        sp(value, rule) { /* Set Property */
            if (this.prop) {
                if (value)
                    if (Array.isArray(value) && value.length === 1 && Array.isArray(value[0]))
                        rule[this.prop] = value[0];
                    else
                        rule[this.prop] = value;
            }
        }

        isRepeating() {
            return !(isNaN(this.r[0]) && isNaN(this.r[1]));
        }

        parse(lx, rule, out_val, ROOT = true) {
                
            if (typeof(lx) == "string")
                lx = whind$1(lx);

            let r = out_val || { v: null },
                bool = false;

            if (ROOT) {
                switch (checkDefaults$1(lx)) {
                    case 1:
                        this.sp(lx.tx, rule);
                        return true;
                    case 0:
                        return false;
                }

                bool = this.innerParser(lx, rule, out_val, r, this.start, this.end);

                //if (!lx.END)
                //    return false;
                //else
                    this.sp(r.v, rule);
            } else
                bool = this.innerParser(lx, rule, out_val, r, this.start, this.end);

            return bool;
        }

        checkForComma(lx) {
            if (this.REQUIRE_COMMA) {
                if (lx.ch == ",")
                    lx.next();
                else return false;
            }
            return true;
        }

        innerParser(lx, rule, out_val, r, start, end) {

            let bool = false;

            repeat:
                for (let j = 0; j < end && !lx.END; j++) {
                    let copy = lx.copy();
                    let temp_r = { v: null };

                    for (let i = 0, l = this.terms.length; i < l; i++) {

                        let term = this.terms[i];

                        if (!term.parse(copy, rule, temp_r, false)) {
                            if (!term.OPTIONAL) {
                                break repeat;
                            }
                        }
                    }

                    if (temp_r.v)
                        this.mergeValues(r, temp_r);

                    lx.sync(copy);

                    bool = true;

                    if (!this.checkForComma(lx))
                        break;
                }

            if (bool)
                //console.log("JUX", s, bool)
                return bool;
        }

        get start() {
            return isNaN(this.r[0]) ? 1 : this.r[0];
        }
        set start(e) {}

        get end() {
            return isNaN(this.r[1]) ? 1 : this.r[1];
        }
        set end(e) {}

        get OPTIONAL() { return this.r[0] === 0 }
        set OPTIONAL(a) {}
    }
    JUX$1.step = 0;
    class AND$1 extends JUX$1 {
        innerParser(lx, rule, out_val, r, start, end) {

            const
                PROTO = new Array(this.terms.length),
                l = this.terms.length;

            let bool = false;

            repeat:
                for (let j = 0; j < end && !lx.END; j++) {

                    const
                        HIT = PROTO.fill(0),
                        copy = lx.copy(),
                        temp_r = { v: null };

                    and:
                        while (true) {



                            for (let i = 0; i < l; i++) {

                                if (HIT[i] === 2) continue;

                                let term = this.terms[i];

                                if (!term.parse(copy, rule, temp_r, false)) {
                                    if (term.OPTIONAL)
                                        HIT[i] = 1;
                                } else {
                                    HIT[i] = 2;
                                    continue and;
                                }
                            }

                            if (HIT.reduce((a, v) => a * v, 1) === 0)
                                break repeat;

                            break
                        }



                    lx.sync(copy);

                    if (temp_r.v)
                        this.mergeValues(r, temp_r);

                    bool = true;

                    if (!this.checkForComma(lx))
                        break;
                }

            return bool;
        }
    }

    class OR$1 extends JUX$1 {
        innerParser(lx, rule, out_val, r, start, end) {

            const
                PROTO = new Array(this.terms.length),
                l = this.terms.length;

            let
                bool = false,
                NO_HIT = true;

            repeat:
                for (let j = 0; j < end && !lx.END; j++) {

                    const HIT = PROTO.fill(0);
                    let copy = lx.copy();
                    let temp_r = { v: null };

                    or:
                        while (true) {
                            for (let i = 0; i < l; i++) {

                                if (HIT[i] === 2) continue;

                                let term = this.terms[i];

                                if (term.parse(copy, temp_r, r, false)) {
                                    NO_HIT = false;
                                    HIT[i] = 2;
                                    continue or;
                                }
                            }

                            if (NO_HIT) break repeat;

                            break;
                        }

                    lx.sync(copy);

                    if (temp_r.v)
                        this.mergeValues(r, temp_r);

                    bool = true;

                    if (!this.checkForComma(lx))
                        break;
                }

            return bool;
        }
    }

    OR$1.step = 0;

    class ONE_OF$1 extends JUX$1 {
        innerParser(lx, rule, out_val, r, start, end) {

            let BOOL = false;

            let j;
            for (j = 0; j < end && !lx.END; j++) {
                let bool = false;
                let copy = lx.copy();
                let temp_r = { v: null };

                for (let i = 0, l = this.terms.length; i < l; i++) {
                    ////if (!this.terms[i]) console.log(this)
                    if (this.terms[i].parse(copy, rule, temp_r, false)) {
                        bool = true;
                        break;
                    }
                }

                if (!bool)
                    break;

                lx.sync(copy);
                
                if (temp_r.v)
                    this.mergeValues(r, temp_r);

                BOOL = true;

                if (!this.checkForComma(lx))
                    break;
            }

            return BOOL;
        }
    }

    ONE_OF$1.step = 0;

    class Segment {
        constructor(parent) {
            this.parent = null;

            this.css_val = "";

            this.val = document.createElement("span");
            this.val.classList.add("prop_value");

            this.list = document.createElement("div");
            this.list.classList.add("prop_list");
            //this.list.style.display = "none"

            this.ext = document.createElement("button");
            this.ext.classList.add("prop_extender");
            this.ext.style.display = "none";
            this.ext.setAttribute("action","ext");

            this.menu_icon = document.createElement("span");
            this.menu_icon.classList.add("prop_list_icon");
            //this.menu_icon.innerHTML = "+"
            this.menu_icon.style.display = "none";
            this.menu_icon.setAttribute("superset", false);
            this.menu_icon.appendChild(this.list);

            this.element = document.createElement("span");
            this.element.classList.add("prop_segment");

            this.element.appendChild(this.menu_icon);
            this.element.appendChild(this.val);
            this.element.appendChild(this.ext);

            this.value_list = [];
            this.subs = [];
            this.old_subs = [];
            this.sib = null;
            this.value_set;
            this.HAS_VALUE = false;
            this.DEMOTED = false;

            this.element.addEventListener("mouseover", e => {
                //this.setList();
            });
        }

        destroy() {
            this.parent = null;
            this.element = null;
            this.val = null;
            this.list = null;
            this.ext = null;
            this.menu_icon = null;
            this.subs.forEach(e => e.destroy());
            this.subs = null;
        }

        reset() {
            this.list.innerHTML = "";
            this.val.innerHTML = "";
            //this.subs.forEach(e => e.destroy);
            this.subs = [];
            this.setElement = null;
            this.changeEvent = null;
        }

        clearSegments(){
            if(this.subs.length > 0){
                this.val.innerHTML = "";
                for(let i = 0; i < this.subs.length; i++){
                    let sub = this.subs[i];
                    sub.destroy();
                }   
                this.subs.length = 0;
            }
        }

        replaceSub(old_sub, new_sub) {
            for (let i = 0; i < this.subs.length; i++) {
                if (this.subs[i] == old_sub) {
                    this.sub[i] = new_sub;
                    this.val.replaceChild(old_sub.element, new_sub.element);
                    return;
                }
            }
        }

        mount(element) {
            element.appendChild(this.element);
        }


        addSub(seg) {
            this.menu_icon.setAttribute("superset", true);
            seg.parent = this;
            this.subs.push(seg);
            this.val.appendChild(seg.element);
        }

        removeSub(seg) {
            if (seg.parent == this) {
                for (let i = 0; i < this.subs.length; i++) {
                    if (this.subs[i] == seg) {
                        this.val.removeChild(seg.element);
                        seg.parent = null;
                        break;
                    }
                }
            }
            return seg;
        }

        setList() {
            //if(this.DEMOTED) debugger
            if (this.prod && this.list.innerHTML == "") {
                if (this.DEMOTED || !this.prod.buildList(this.list, this))
                    this.menu_icon.style.display = "none";
                else
                    this.menu_icon.style.display = "inline-block";
            }
        }
        change(e) {
            if (this.changeEvent)
                this.changeEvent(this.setElement, this, e);
        }

        setValueHandler(element, change_event_function) {
            this.val.innerHTML = "";
            this.val.appendChild(element);

            if (change_event_function) {
                this.setElement = element;
                this.changeEvent = change_event_function;
                this.setElement.onchange = this.change.bind(this);
            }

            this.HAS_VALUE = true;
            //this.menu_icon.style.display = "none";
            this.setList();
        }

        set value(v) {
            this.val.innerHTML = v;
            this.css_val = v;
            this.HAS_VALUE = true;
            this.setList();
        }

        get value_count() {
            if (this.subs.length > 0)
                return this.subs.length
            return (this.HAS_VALUE) ? 1 : 0;
        }

        promote() {

        }

        demote() {
            let seg = new Segment;
            seg.prod = this.prod;
            seg.css_val = this.css_val;

            if (this.change_event_function) {
                seg.changeEvent = this.changeEvent;
                seg.setElement = this.setElement;
                seg.setElement.onchange = seg.change.bind(seg);
            }

            let subs = this.subs;

            if (subs.length > 0) {

                for (let i = 0; i < this.subs.length; i++) 
                    seg.addSub(this.subs[i]);
                
            } else {


                let children = this.val.childNodes;

                if (children.length > 0) {
                    for (let i = 0, l = children.length; i < l; i++) {
                        seg.val.appendChild(children[0]);
                    }
                } else {
                    seg.val.innerHTML = this.val.innerHTML;
                }
            }


            this.menu_icon.innerHTML = "";
            this.menu_icon.style.display = "none";
            this.menu_icon.setAttribute("superset", false);
            this.list.innerHTML = "";

            this.reset();

            this.addSub(seg);
            seg.setList();
            
            this.DEMOTED = true;
        }

        addRepeat(seg) {
            if (!this.DEMOTED)
                //Turn self into own sub seg
                this.demote();
            this.addSub(seg);
            seg.setList();
        }

        repeat(prod = this.prod) {
            
            if (this.value_count <= this.end && this.prod.end > 1) {
                this.ext.style.display = "inline-block";

                let root_x = 0;
                let width = 0;
                let diff_width = 0;

                const move = (e) => {

                    let diff = e.clientX - root_x;

                    let EXTENDABLE = this.value_count < this.end;
                    let RETRACTABLE = this.value_count > 1;

                    if(EXTENDABLE && RETRACTABLE)
                        this.ext.setAttribute("action","both");
                    else if(EXTENDABLE)
                        this.ext.setAttribute("action","ext");
                    else
                        this.ext.setAttribute("action","ret");

                    if (diff > 15 && EXTENDABLE) {
                        let bb = this.element;

                        if (!this.DEMOTED) {
                            //Turn self into own sub seg
                            this.demote();
                        }

                        if (this.old_subs.length > 1) {
                            this.addSub(this.old_subs.pop());
                        } else {
                            prod.default(this, true);
                        }

                        let w = this.element.clientWidth;
                        diff_width = w - width;
                        width = w;
                        root_x += diff_width;

                        return;
                    }

                    let last_sub = this.subs[this.subs.length - 1];

                    if (diff < -5 - last_sub.width && RETRACTABLE) {
                        const sub = this.subs[this.subs.length - 1];
                        this.old_subs.push(sub);
                        this.removeSub(sub);
                        this.subs.length = this.subs.length - 1;

                        let w = this.element.clientWidth;
                        diff_width = w - width;
                        width = w;

                        root_x += diff_width;
                    }
                };

                const up = (e) => {
                    window.removeEventListener("pointermove", move);
                    window.removeEventListener("pointerup", up);
                };

                this.ext.onpointerdown = e => {
                    width = this.element.clientWidth;
                    root_x = e.clientX;
                    window.addEventListener("pointermove", move);
                    window.addEventListener("pointerup", up);
                };


                /*
                this.ext.onclick = e => {
                    if (this.subs.length == 0)
                        //Turn self into own sub seg
                        this.demote()

                    prod.default(this, true);

                    if (this.value_count >= this.end)
                        this.ext.style.display = "none";
                }
                */
            } else {
                this.ext.style.display = "none";
            }
            this.setList();
            this.update();
        }

        get width() {
            return this.element.clientWidth;
        }

        update() {
            if (this.parent)
                this.parent.update(this);
            else {
                let val = this.getValue();
            }
        }

        getValue() {
            let val = "";

            if (this.subs.length > 0)
                for (let i = 0; i < this.subs.length; i++)
                    val += " " + this.subs[i].getValue();
            else
                val = this.css_val;
            return val;
        }

        toString() {
            return this.getValue();
        }
    }

    class ValueTerm$1 {

        constructor(value, getPropertyParser, definitions, productions) {

            if(value instanceof JUX)
                return value;
            

            this.value = null;

            const IS_VIRTUAL = { is: false };
            
            if(typeof(value) == "string")
                var u_value = value.replace(/\-/g,"_");

            if (!(this.value = types[u_value]))
                this.value = getPropertyParser(u_value, IS_VIRTUAL, definitions, productions);

            this.prop = "";

            if (!this.value)
                return new LiteralTerm$1(value);

            if(this.value instanceof JUX){
                if (IS_VIRTUAL.is)
                    this.value.virtual = true;
                return this.value;
            }

        }

        seal(){}

        parse(l, rule, r, ROOT = true) {
            if (typeof(l) == "string")
                l = whind$1(l);

            if (ROOT) {

                switch(checkDefaults(l)){
                    case 1:
                    rule[this.prop] = l.tx;
                    return true;
                    case 0:
                    return false;
                }
            }

            let rn = { v: null };

            let v = this.value.parse(l, rule, rn);

            if (rn.v) {
                if (r)
                    if (r.v) {
                        if (Array.isArray(r.v)) {
                            if (Array.isArray(rn.v) && !this.virtual)
                                r.v = r.v.concat(rn.v);
                            else
                                r.v.push(rn.v);
                        } else {
                            if (Array.isArray(rn.v) && !this.virtual)
                                r.v = ([r.v]).concat(rn.v);
                            else
                                r.v = [r.v, rn.v];
                        }
                    } else
                        r.v = (this.virtual) ? [rn.v] : rn.v;

                if (this.prop && !this.virtual)
                    rule[this.prop] = rn.v;

                return true;

            } else if (v) {
                if (r)
                    if (r.v) {
                        if (Array.isArray(r.v))
                            r.v.push(v);
                        else
                            r.v = [r.v, v];
                    } else
                        r.v = v;

                if (this.prop && !this.virtual && ROOT)
                    rule[this.prop] = v;

                return true;
            } else
                return false;
        }

        get OPTIONAL (){ return false }
        set OPTIONAL (a){}
    }

    class LiteralTerm$1 {

        constructor(value, type) {
            
            if(type == whind$1.types.string)
                value = value.slice(1,-1);

            this.value = value;
            this.prop = null;
        }

        seal(){}

        parse(l, rule, r, root = true) {

            if (typeof(l) == "string")
                l = whind$1(l);

            if (root) {
                switch(checkDefaults(l)){
                    case 1:
                    rule[this.prop] = l.tx;
                    return true;
                    case 0:
                    return false;
                }
            }

            let v = l.tx;
            if (v == this.value) {
                l.next();

                if (r)
                    if (r.v) {
                        if (Array.isArray(r.v))
                            r.v.push(v);
                        else {
                            let t = r.v;
                            r.v = [t, v];
                        }
                    } else
                        r.v = v;

                if (this.prop  && !this.virtual && root)
                    rule[this.prop] = v;

                return true;
            }
            return false;
        }

        get OPTIONAL (){ return false }
        set OPTIONAL (a){}
    }

    class ValueTerm$2 extends ValueTerm$1 {

        default (seg, APPEND = false, value = null) {
            if (!APPEND) {
                let element = this.value.valueHandler(value, seg);

                if (value) {
                    seg.css_val = value.toString();
                }
                seg.setValueHandler(element, (ele, seg, event) => {
                    seg.css_val = element.css_value;
                    seg.update();
                });
            } else {
                let sub = new Segment();
                let element = this.value.valueHandler(value, sub);
                if (value)
                    sub.css_val = value.toString();

                sub.setValueHandler(element, (ele, seg, event) => {
                    seg.css_val = element.css_value;
                    seg.update();
                });
                //sub.prod = list;
                seg.addSub(sub);
            }
        }

        buildInput(rep = 1, value) {
            let seg = new Segment();
            this.default(seg, false, value);
            return seg;
        }

        parseInput(l, seg, APPEND = false) {
            let val = this.value.parse(l);

            if (val) {
                this.default(seg, APPEND, val);
                return true;
            }

            return val;
        }

        list(ele, slot) {
            let element = document.createElement("div");
            element.classList.add("option");
            element.innerHTML = this.value.label_name || this.value.name;
            ele.appendChild(element);

            element.addEventListener("click", e => {

                slot.innerHTML = this.value;
                if (slot) {
                    let element = this.value.valueHandler();
                    element.addEventListener("change", e => {

                        let value = element.value;
                        slot.css_val = value;
                        slot.update();
                    });
                    slot.setValueHandler(element);
                } else {
                    let sub = new Segment();
                    sub.setValueHandler(this.value);
                    seg.addSub(sub);
                }
            });

            return 1;
        }

        setSegment(segment) {
            segment.element.innerHTML = this.value.name;
        }
    }

    class BlankTerm extends LiteralTerm$1 {

        default (seg, APPEND = false) {

            if (!APPEND) {
                seg.value = "  ";
            } else {
                let sub = new Segment();
                sub.value = "";
                seg.addSub(sub);
            }
        }

        list(ele, slot) {
            let element = document.createElement("div");
            element.innerHTML = this.value;
            element.classList.add("option");
            //        ele.appendChild(element) 

            return 1;
        }

        parseInput(seg, APPEND = false) {
            this.default(seg, APPEND);
            return false;
        }
    }

    class LiteralTerm$2 extends LiteralTerm$1 {

        default (seg, APPEND = false) {
            if (!APPEND) {
                seg.value = this.value;
            } else {
                let sub = new Segment();
                sub.value = this.value;
                seg.addSub(sub);
            }
        }

        list(ele, slot) {
            let element = document.createElement("div");
            element.innerHTML = this.value;
            element.classList.add("option");
            ele.appendChild(element);
            element.addEventListener("click", e => {
                slot.value = this.value + "";
                slot.update();
            });

            return 1;
        }

        parseInput(l, seg, APPEND = false) {
            if (typeof(l) == "string")
                l = whind(l);

            if (l.tx == this.value) {
                l.next();
                this.default(seg, APPEND);
                return true;
            }

            return false;
        }
    }

    class SymbolTerm$2 extends LiteralTerm$2 {
        list() { return 0 }

        parseInput(l, seg, r) {
            if (typeof(l) == "string")
                l = whind(l);

            if (l.tx == this.value) {
                l.next();
                let sub = new Segment();
                sub.value = this.value + "";
                seg.addSub(sub);
                return true;
            }

            return false;
        }
    }

    /**
     * wick internals.
     * @class      JUX (name)
     */
    class JUX$2 extends JUX$1 {
        //Adds an entry in options list. 


        createSegment() {
            let segment = new Segment();
            segment.start = this.start;
            segment.end = this.end;
            segment.prod = this;
            return segment
        }

        insertBlank(seg){
            let blank = new BlankTerm;
            blank.parseInput(seg);
        }

        buildList(list, slot) {

            if (!slot) {
                let element = document.createElement("div");
                element.classList.add("prop_slot");
                slot = element;
            }

            if (!list) {
                list = document.createElement("div");
                list.classList.add("prop_slot");
                slot.appendChild(list);
            }
            let count = 0;
            //Build List
            for (let i = 0, l = this.terms.length; i < l; i++) {
                count += this.terms[i].list(list, slot);
            }

            return count > 1;
        }

        seal() {}

        parseInput(lx, segment, list) {

            if (typeof(lx) == "string")
                lx = whind$1(lx);

            return this.pi(lx, segment, list);
        }

        default (segment, EXTENDED = true) {
            let seg = this.createSegment();

            segment.addSub(seg);

            for (let i = 0, l = this.terms.length; i < l; i++) {
                this.terms[i].default(seg, l > 1);
            }
            seg.setList();

            if (!EXTENDED) seg.repeat();
        }

        pi(lx, ele, lister = this, start = this.start, end = this.end) {
            
            let segment = this.createSegment();

            let bool = false;

            repeat:
                for (let j = 0; j < end && !lx.END; j++) {
                    const REPEAT = j > 0;

                    let copy = lx.copy();

                    let seg = (REPEAT) ? new Segment : segment;

                    seg.prod = this;

                    for (let i = 0, l = this.terms.length; i < l; i++) {

                        let term = this.terms[i];

                        if (!term.parseInput(copy, seg, l > 1)) {
                            if (!term.OPTIONAL) {
                                break repeat;
                            }
                        }
                    }

                    lx.sync(copy);

                    bool = true;

                    if (!this.checkForComma(lx))
                        break;

                    if (REPEAT)
                        segment.addRepeat(seg);
                }

                this.capParse(segment, ele, bool);
                
                return bool;
        }

        capParse(segment, ele, bool){
            if (bool) {
                segment.repeat();
                if (ele)
                    ele.addSub(segment);
                this.last_segment = segment;
            }else {
                segment.destroy();
                if(this.OPTIONAL){
                    if(ele){
                        let segment = this.createSegment();
                        let blank = new BlankTerm();
                        blank.parseInput(segment);
                        segment.prod = this;
                        
                        segment.repeat();
                        ele.addSub(segment);
                    }
                }
            }
        }

        buildInput(repeat = 1, lex) {

            this.last_segment = null;
            let seg = new Segment;
            seg.start = this.start;
            seg.end = this.end;
            seg.prod = this;
            this.parseInput(lex, seg, this);
            return this.last_segment;
        }

        list(){
            
        }
    }

    class AND$2 extends JUX$2 {

        default (segment, EXTENDED = false) {
            //let seg = this.createSegment();
            //segment.addSub(seg);
            for (let i = 0, l = this.terms.length; i < l; i++) {
                this.terms[i].default(segment, i > 1);
            }
            //seg.repeat();
        }

        list(ele, slot) {

            let name = (this.name) ? this.name.replace("\_\g", " ") : this.terms.reduce((r, t) => r += " | " + t.name, "");
            let element = document.createElement("div");
            element.classList.add("option");
            element.innerHTML = name;
            ele.appendChild(element);

            element.addEventListener("click", e => {
                
                slot.innerHTML = this.value;
                if (slot) {
                    slot.clearSegments();
                    this.default(slot);
                    slot.update();
                } else {
                    let sub = new Segment();
                    sub.setValueHandler(this.value);
                    seg.addSub(sub);
                }
            });

            return 1;
        }

        pi(lx, ele, lister = this, start = 1, end = 1) {

            outer: for (let j = 0; j < end && !lx.END; j++) {
                for (let i = 0, l = this.terms.length; i < l; i++)
                    if (!this.terms[i].parseInput(lx, ele)) return (start === 0) ? true : false
            }

            segment.repeat();

            return true;
        }
    }
    Object.assign(AND$2.prototype, AND$1.prototype);

    class OR$2 extends JUX$2 {

        default (segment, EXTENDED = false) {
            //let seg = this.createSegment();
            //segment.addSub(seg);
            for (let i = 0, l = this.terms.length; i < l; i++) {
                this.terms[i].default(segment, l > 1);
            }
            //seg.repeat();
        }

        buildList(list, slot) {
            return false;
        }

        list(ele, slot) {

            let name = this.terms.reduce((r, t) => r += " | " + t.name, "");
            let element = document.createElement("div");
            element.classList.add("option");
            element.innerHTML = name;
            ele.appendChild(element);

            element.addEventListener("click", e => {
                
                slot.innerHTML = this.value;
                if (slot) {
                    slot.clearSegments();
                    this.default(slot);
                    slot.update();
                } else {
                    let sub = new Segment();
                    sub.setValueHandler(this.value);
                    seg.addSub(sub);
                }
            });

            return 1;
        }

        pi(lx, ele, lister = this, start = this.start, end = this.end) {
            
            let segment = ele; //this.createSegment()

            let bool = false;

            let OVERALL_BOOL = false;

            for (let j = 0; j < end && !lx.END; j++) {
                const REPEAT = j > 0;

                let seg = (REPEAT) ? new Segment : segment;


                bool = false;

                this.count = (this.count) ? this.count:this.count = 0;
                
                outer:
                //User "factorial" expression to isolate used results in a continous match. 
                while(true){
                    for (let i = 0, l = this.terms.length; i < l; i++) {
                        //if(this.terms[i].count == this.count) continue

                        if (this.terms[i].parseInput(lx, seg, true)) {
                            this.terms[i].count = this.count;
                            OVERALL_BOOL = true;
                            bool = true;
                            continue outer;
                        }
                    }
                    break;
                }

                if (!bool && j < start) {
                    bool = false;
                } else if (start === 0)
                    bool = true;
                    if (REPEAT)
                segment.addRepeat(seg);
            }

            if (OVERALL_BOOL) {
                segment.repeat();
                //if (ele)
                //    ele.addSub(segment);
                this.last_segment = segment;
            }


            return (!bool && start === 0) ? true : bool;
        }
    }

    Object.assign(OR$2.prototype, OR$1.prototype);

    class ONE_OF$2 extends JUX$2 {

        default (segment, EXTENDED = false) {
            let seg = this.createSegment();
            this.terms[0].default(seg);
            segment.addSub(seg);
            seg.setList();
            if (!EXTENDED) seg.repeat();
        }

        list(ele, slot) {
            let name = (this.name) ? this.name.replace(/_/g, " ") : this.terms.reduce((r, t) => r += " | " + t.name, "");
            let element = document.createElement("div");
            element.classList.add("option");
            element.innerHTML = name;
            ele.appendChild(element);

            element.addEventListener("click", e => {
                //debugger
                slot.innerHTML = this.value;
                if (slot) {
                    slot.clearSegments();
                    this.default(slot);
                    slot.update();
                } else {
                    let sub = new Segment();
                    sub.setValueHandler(this.value);
                    seg.addSub(sub);
                }
            });

            return 1;
        }

        pi(lx, ele, lister = this, start = this.start, end = this.end) {
            //List
            let segment = this.createSegment();

            //Add new
            let bool = false;

            let j = 0;

            //Parse Input
            for (; j < end && !lx.END; j++) {
                const REPEAT = j > 0;

                let seg = segment;
                
                if(REPEAT){
                    seg = new Segment;
                    seg.prod = this;
                }

                bool = false;

                for (let i = 0, l = this.terms.length; i < l; i++) {
                    bool = this.terms[i].parseInput(lx, seg);
                    if (bool) break;
                }

                if (!bool) {
                    if (j < start) {
                        bool = false;
                        break;
                    }
                }
                if (REPEAT)
                    segment.addRepeat(seg);

            }

            this.capParse(segment, ele, bool);

            return  bool;
        }
    }

    Object.assign(ONE_OF$2.prototype, ONE_OF$1.prototype);

    var ui_productions = /*#__PURE__*/Object.freeze({
        JUX: JUX$2,
        AND: AND$2,
        OR: OR$2,
        ONE_OF: ONE_OF$2,
        LiteralTerm: LiteralTerm$2,
        ValueTerm: ValueTerm$2,
        SymbolTerm: SymbolTerm$2
    });

    /* https://www.w3.org/TR/css-shapes-1/#typedef-basic-shape */

    /**
     * @brief Path Info
     * @details Path syntax information for reference
     * 
     * MoveTo: M, m
     * LineTo: L, l, H, h, V, v
     * Cubic Bézier Curve: C, c, S, s
     * Quadratic Bézier Curve: Q, q, T, t
     * Elliptical Arc Curve: A, a
     * ClosePath: Z, z
     * 
     * Capital symbols represent absolute positioning, lowercase is relative
     */

    /**
     * CSS Property Definitions https://www.w3.org/TR/css3-values/#value-defs
     * @alias module:wick~internals.css.property_definitions.
     * @enum {string}
     */
    const property_definitions$1 = {

    	/* https://drafts.csswg.org/css-writing-modes-3/ */
    		direction:"ltr|rtl",
    		unicode_bidi:"normal|embed|isolate|bidi-override|isolate-override|plaintext",
    		writing_mode:"horizontal-tb|vertical-rl|vertical-lr",
    		text_orientation:"mixed|upright|sideways",
    		glyph_orientation_vertical:`auto|0deg|90deg|"0"|"90"`,
    		text_combine_upright:"none|all",

    	/* https://www.w3.org/TR/css-position-3 */ 
    		position: "static|relative|absolute|sticky|fixed",
    		top: `<length>|<percentage>|auto`,
    		left: `<length>|<percentage>|auto`,
    		bottom: `<length>|<percentage>|auto`,
    		right: `<length>|<percentage>|auto`,
    		offset_before: `<length>|<percentage>|auto`,
    		offset_after: `<length>|<percentage>|auto`,
    		offset_start: `<length>|<percentage>|auto`,
    		offset_end: `<length>|<percentage>|auto`,
    		z_index:"auto|<integer>",

    	/* https://www.w3.org/TR/css-display-3/ */
    		display: `[ <display_outside> || <display_inside> ] | <display_listitem> | <display_internal> | <display_box> | <display_legacy>`,

    	/* https://www.w3.org/TR/css-box-3 */
    		margin: `[<length>|<percentage>|0|auto]{1,4}`,
    		margin_top: `<length>|<percentage>|0|auto`,
    		margin_right: `<length>|<percentage>|0|auto`,
    		margin_bottom: `<length>|<percentage>|0|auto`,
    		margin_left: `<length>|<percentage>|0|auto`,

    		margin_trim:"none|in-flow|all",

    		padding: `[<length>|<percentage>|0|auto]{1,4}`,
    		padding_top: `<length>|<percentage>|0|auto`,
    		padding_right: `<length>|<percentage>|0|auto`,
    		padding_bottom: `<length>|<percentage>|0|auto`,
    		padding_left: `<length>|<percentage>|0|auto`,

    	/* https://www.w3.org/TR/CSS2/visuren.html */
    		float: `left|right|none`,
    		clear: `left|right|both|none`,

    	/* https://drafts.csswg.org/css-sizing-3 todo:implement fit-content(%) function */
    		box_sizing: `content-box | border-box`,
    		width: `<length>|<percentage>|min-content|max-content|fit-content|auto`,
    		height: `<length>|<percentage>|min-content|max-content|fit-content|auto`,
    		min_width: `<length>|<percentage>|min-content|max-content|fit-content|auto`,
    		max_width: `<length>|<percentage>|min-content|max-content|fit-content|auto|none`,
    		min_height: `<length>|<percentage>|min-content|max-content|fit-content|auto`,
    		max_height: `<length>|<percentage>|min-content|max-content|fit-content|auto|none`,

    	/* https://www.w3.org/TR/2018/REC-css-color-3-20180619 */
    		color: `<color>`,
    		opacity: `<alphavalue>`,

    	/* https://www.w3.org/TR/css-backgrounds-3/ */
    		background_color: `<color>`,
    		background_image: `<bg_image>#`,
    		background_repeat: `<repeat_style>#`,
    		background_attachment: `scroll|fixed|local`,
    		background_position: `[<percentage>|<length>]{1,2}|[top|center|bottom]||[left|center|right]`,
    		background_clip: `<box>#`,
    		background_origin: `<box>#`,
    		background_size: `<bg_size>#`,
    		background: `[<bg_layer>#,]?<final_bg_layer>`,
    		border_color: `<color>{1,4}`,
    		border_top_color: `<color>`,
    		border_right_color: `<color>`,
    		border_bottom_color: `<color>`,
    		border_left_color: `<color>`,

    		border_top_width: `<line_width>`,
    		border_right_width: `<line_width>`,
    		border_bottom_width: `<line_width>`,
    		border_left_width: `<line_width>`,
    		border_width: `<line_width>{1,4}`,

    		border_style: `<line_style>{1,4}`,
    		border_top_style: `<line_style>`,
    		border_right_style: `<line_style>`,
    		border_bottom_style: `<line_style>`,
    		border_left_style: `<line_style>`,

    		border_top: `<line_width>||<line_style>||<color>`,
    		border_right: `<line_width>||<line_style>||<color>`,
    		border_bottom: `<line_width>||<line_style>||<color>`,
    		border_left: `<line_width>||<line_style>||<color>`,

    		border_radius: `<length_percentage>{1,4}[ / <length_percentage>{1,4}]?`,
    		border_top_left_radius: `<length_percentage>{1,2}`,
    		border_top_right_radius: `<length_percentage>{1,2}`,
    		border_bottom_right_radius: `<length_percentage>{1,2}`,
    		border_bottom_left_radius: `<length_percentage>{1,2}`,

    		border: `<line_width>||<line_style>||<color>`,

    		border_image: `<border_image_source>||<border_image_slice>[/<border_image_width>|/<border_image_width>?/<border_image_outset>]?||<border_image_repeat>`,
    		border_image_source: `none|<image>`,
    		border_image_slice: `[<number>|<percentage>]{1,4}&&fill?`,
    		border_image_width: `[<length_percentage>|<number>|auto]{1,4}`,
    		border_image_outset: `[<length>|<number>]{1,4}`,
    		border_image_repeat: `[stretch|repeat|round|space]{1,2}`,
    		box_shadow: `none|<shadow>#`,
    		line_height: `normal|<percentage>|<length>|<number>`,
    		overflow: 'visible|hidden|scroll|auto',

    	/* https://www.w3.org/TR/css-fonts-4 */
    		font_display: "auto|block|swap|fallback|optional",
    		font_family: `[[<generic_family>|<family_name>],]*[<generic_family>|<family_name>]`,
    		font_language_override:"normal|<string>",
    		font: `[[<font_style>||<font_variant>||<font_weight>]?<font_size>[/<line_height>]?<font_family>]|caption|icon|menu|message-box|small-caption|status-bar`,
    		font_max_size: `<absolute_size>|<relative_size>|<length>|<percentage>|infinity`,
    		font_min_size: `<absolute_size>|<relative_size>|<length>|<percentage>`,
    		font_optical_sizing: `auto|none`,
    		font_pallette: `normal|light|dark|<identifier>`,
    		font_size: `<absolute_size>|<relative_size>|<length>|<percentage>`,
    		font_stretch:"<percentage>|normal|ultra-condensed|extra-condensed|condensed|semi-condensed|semi-expanded|expanded|extra-expanded|ultra-expanded",
    		font_style: `normal|italic|oblique<angle>?`,
    		font_synthesis:"none|[weight||style]",
    		font_synthesis_small_caps:"auto|none",
    		font_synthesis_style:"auto|none",
    		font_synthesis_weight:"auto|none",
    		font_variant_alternates:"normal|[stylistic(<feature-value-name>)||historical-forms||styleset(<feature-value-name>#)||character-variant(<feature-value-name>#)||swash(<feature-value-name>)||ornaments(<feature-value-name>)||annotation(<feature-value-name>)]",
    		font_variant_emoji:"auto|text|emoji|unicode",
    		font_variation_settings:" normal|[<string><number>]#",
    		font_size_adjust: `<number>|none`,
    		
    		font_weight: `normal|bold|bolder|lighter|100|200|300|400|500|600|700|800|900`,

    	/* https://www.w3.org/TR/css-fonts-3/ */
    		font_kerning: ` auto | normal | none`,
    		font_variant: `normal|none|[<common-lig-values>||<discretionary-lig-values>||<historical-lig-values>||<contextual-alt-values>||[small-caps|all-small-caps|petite-caps|all-petite-caps|unicase|titling-caps]||<numeric-figure-values>||<numeric-spacing-values>||<numeric-fraction-values>||ordinal||slashed-zero||<east-asian-variant-values>||<east-asian-width-values>||ruby||[sub|super]]`,
    		font_variant_ligatures:`normal|none|[<common-lig-values>||<discretionary-lig-values>||<historical-lig-values>||<contextual-alt-values> ]`,
    		font_variant_position:`normal|sub|super`,
    		font_variant_caps:`normal|small-caps|all-small-caps|petite-caps|all-petite-caps|unicase|titling-caps`,
    		font_variant_numeric: "normal | [ <numeric-figure-values> || <numeric-spacing-values> || <numeric-fraction-values> || ordinal || slashed-zero ]",
    		font_variant_east_asian:" normal | [ <east-asian-variant-values> || <east-asian-width-values> || ruby ]",

    	/* https://drafts.csswg.org/css-text-3 */
    		hanging_punctuation : "none|[first||[force-end|allow-end]||last]",
    		hyphens : "none|manual|auto",
    		letter_spacing: `normal|<length>`,
    		line_break : "auto|loose|normal|strict|anywhere",
    		overflow_wrap : "normal|break-word|anywhere",
    		tab_size : "<length>|<number>",
    		text_align : "start|end|left|right|center|justify|match-parent|justify-all",
    		text_align_all : "start|end|left|right|center|justify|match-parent",
    		text_align_last : "auto|start|end|left|right|center|justify|match-parent",
    		text_indent : "[[<length>|<percentage>]&&hanging?&&each-line?]",
    		text_justify : "auto|none|inter-word|inter-character",
    		text_transform : "none|[capitalize|uppercase|lowercase]||full-width||full-size-kana",
    		white_space : "normal|pre|nowrap|pre-wrap|break-spaces|pre-line",
    		word_break : " normal|keep-all|break-all|break-word",
    		word_spacing : "normal|<length>",
    		word_wrap : "  normal | break-word | anywhere",

    	/* https://drafts.csswg.org/css-text-decor-3 */
    		text_decoration: "<text-decoration-line>||<text-decoration-style>||<color>",
    		text_decoration_color:"<color>",
    		text_decoration_line:"none|[underline||overline||line-through||blink]",
    		text_decoration_style:"solid|double|dotted|dashed|wavy",
    		text_emphasis:"<text-emphasis-style>||<text-emphasis-color>",
    		text_emphasis_color:"<color>",
    		text_emphasis_position:"[over|under]&&[right|left]?",
    		text_emphasis_style:"none|[[filled|open]||[dot|circle|double-circle|triangle|sesame]]|<string>",
    		text_shadow:"none|[<color>?&&<length>{2,3}]#",
    		text_underline_position:"auto|[under||[left|right]]",

    	/* Flex Box https://www.w3.org/TR/css-flexbox-1/ */
    		align_content: `flex-start | flex-end | center | space-between | space-around | stretch`,
    		align_items: `flex-start | flex-end | center | baseline | stretch`,
    		align_self: `auto | flex-start | flex-end | center | baseline | stretch`,
    		flex:`none|[<flex-grow> <flex-shrink>?||<flex-basis>]`,
    		flex_basis:`content|<width>`,
    		flex_direction:`row | row-reverse | column | column-reverse`,
    		flex_flow:`<flex-direction>||<flex-wrap>`,
    		flex_grow:`<number>`,
    		flex_shrink:`<number>`,
    		flex_wrap:`nowrap|wrap|wrap-reverse`,
    		justify_content :"flex-start | flex-end | center | space-between | space-around",
    		order:`<integer>`,

    	/* https://drafts.csswg.org/css-transitions-1/ */
    		transition: `<single_transition>#`,
    		transition_delay: `<time>#`,
    		transition_duration: `<time>#`,
    		transition_property: `none|<single_transition_property>#`,
    		transition_timing_function: `<timing_function>#`,

    	/* CSS3 Animation https://drafts.csswg.org/css-animations-1/ */
    		animation: `<single_animation>#`,
    		animation_name: `[none|<keyframes_name>]#`,
    		animation_duration: `<time>#`,
    		animation_timing_function: `<timing_function>#`,
    		animation_iteration_count: `<single_animation_iteration_count>#`,
    		animation_direction: `<single_animation_direction>#`,
    		animation_play_state: `<single_animation_play_state>#`,
    		animation_delayed: `<time>#`,
    		animation_fill_mode: `<single_animation_fill_mode>#`,

    	/* https://svgwg.org/svg2-draft/interact.html#PointerEventsProperty */
    		pointer_events : `visiblePainted|visibleFill|visibleStroke|visible|painted|fill|stroke|all|none|auto`,

    	/* https://drafts.csswg.org/css-ui-3 */
    		caret_color :"auto|<color>",
    		cursor:"[[<url> [<number><number>]?,]*[auto|default|none|context-menu|help|pointer|progress|wait|cell|crosshair|text|vertical-text|alias|copy|move|no-drop|not-allowed|grab|grabbing|e-resize|n-resize|ne-resize|nw-resize|s-resize|se-resize|sw-resize|w-resize|ew-resize|ns-resize|nesw-resize|nwse-resize|col-resize|row-resize|all-scroll|zoom-in|zoom-out]]",
    		outline:"[<outline-color>||<outline-style>||<outline-width>]",
    		outline_color:"<color>|invert",
    		outline_offset:"<length>",
    		outline_style:"auto|<border-style>",
    		outline_width:"<line-width>",
    		resize:"none|both|horizontal|vertical",
    		text_overflow:"clip|ellipsis",

    	/* https://drafts.csswg.org/css-content-3/ */
    		bookmark_label:"<content-list>",
    		bookmark_level:"none|<integer>",
    		bookmark_state:"open|closed",
    		content:"normal|none|[<content-replacement>|<content-list>][/<string>]?",
    		quotes:"none|[<string><string>]+",
    		string_set:"none|[<custom-ident><string>+]#",
    	
    	/*https://www.w3.org/TR/CSS22/tables.html*/
    		caption_side:"top|bottom",
    		table_layout:"auto|fixed",
    		border_collapse:"collapse|separate",
    		border_spacing:"<length><length>?",
    		empty_cells:"show|hide",

    	/* https://www.w3.org/TR/CSS2/page.html */
    		page_break_before:"auto|always|avoid|left|right",
    		page_break_after:"auto|always|avoid|left|right",
    		page_break_inside:"auto|avoid|left|right",
    		orphans:"<integer>",
    		widows:"<integer>",

    	/* https://drafts.csswg.org/css-lists-3 */
    		counter_increment:"[<custom-ident> <integer>?]+ | none",
    		counter_reset:"[<custom-ident> <integer>?]+|none",
    		counter_set:"[<custom-ident> <integer>?]+|none",
    		list_style:"<list-style-type>||<list-style-position>||<list-style-image>",
    		list_style_image:"<url>|none",
    		list_style_position:"inside|outside",
    		list_style_type:"<counter-style>|<string>|none",
    		marker_side:"list-item|list-container",


    	vertical_align: `baseline|sub|super|top|text-top|middle|bottom|text-bottom|<percentage>|<length>`,

    	/* Visual Effects */
    	clip: '<shape>|auto',
    	visibility: `visible|hidden|collapse`,
    	content: `normal|none|[<string>|<uri>|<counter>|attr(<identifier>)|open-quote|close-quote|no-open-quote|no-close-quote]+`,
    	quotas: `[<string><string>]+|none`,
    	counter_reset: `[<identifier><integer>?]+|none`,
    	counter_increment: `[<identifier><integer>?]+|none`,
    };

    //import util from "util"
    const standard_productions$1 = {
        JUX,
        AND,
        OR,
        ONE_OF,
        LiteralTerm,
        ValueTerm,
        SymbolTerm
    };
    function getPropertyParser$1(property_name, IS_VIRTUAL = { is: false }, definitions = null, productions = standard_productions$1) {

        let prop = definitions[property_name];

        if (prop) {

            if (typeof(prop) == "string") {
                prop = definitions[property_name] = CreatePropertyParser$1(prop, property_name, definitions, productions);
            }
            prop.name = property_name;
            return prop;
        }

        if (!definitions.__virtual)
            definitions.__virtual = Object.assign({}, virtual_property_definitions);

        prop = definitions.__virtual[property_name];

        if (prop) {

            IS_VIRTUAL.is = true;

            if (typeof(prop) == "string") {
                prop = definitions.__virtual[property_name] = CreatePropertyParser$1(prop, "", definitions, productions);
                prop.virtual = true;
                prop.name = property_name;
            }

            return prop;
        }

        return null;
    }


    function CreatePropertyParser$1(notation, name, definitions, productions) {

        const l = whind$1(notation);
        const important = { is: false };

        let n = d$2(l, definitions, productions);
        
        n.seal();

        //if (n instanceof productions.JUX && n.terms.length == 1 && n.r[1] < 2)
        //    n = n.terms[0];

        n.prop = name;
        n.IMP = important.is;

        /*//******** DEV 
        console.log("")
        console.log("")
        console.log(util.inspect(n, { showHidden: false, depth: null })) 
        //********** END Dev*/

        return n;
    }

    function d$2(l, definitions, productions, super_term = false, oneof_group = false, or_group = false, and_group = false, important = null) {
        let term, nt, v;
        const { JUX: JUX$$1, AND: AND$$1, OR: OR$$1, ONE_OF: ONE_OF$$1, LiteralTerm: LiteralTerm$$1, ValueTerm: ValueTerm$$1, SymbolTerm: SymbolTerm$$1 } = productions;

        while (!l.END) {

            switch (l.ch) {
                case "]":
                    return term;
                    break;
                case "[":

                    v = d$2(l.next(), definitions, productions, true);
                    l.assert("]");
                    v = checkExtensions$1(l, v, productions);

                    if (term) {
                        if (term instanceof JUX$$1 && term.isRepeating()) term = foldIntoProduction$1(productions, new JUX$$1, term);
                        term = foldIntoProduction$1(productions, term, v);
                    } else
                        term = v;
                    break;

                case "<":

                    v = new ValueTerm$$1(l.next().tx, getPropertyParser$1, definitions, productions);
                    l.next().assert(">");

                    v = checkExtensions$1(l, v, productions);

                    if (term) {
                        if (term instanceof JUX$$1 /*&& term.isRepeating()*/) term = foldIntoProduction$1(productions, new JUX$$1, term);
                        term = foldIntoProduction$1(productions, term, v);
                    } else {
                        term = v;
                    }
                    break;

                case "&":

                    if (l.pk.ch == "&") {

                        if (and_group)
                            return term;

                        nt = new AND$$1();

                        if (!term) throw new Error("missing term!");

                        nt.terms.push(term);

                        l.sync().next();

                        while (!l.END) {
                            nt.terms.push(d$2(l, definitions, productions, super_term, oneof_group, or_group, true, important));
                            if (l.ch !== "&" || l.pk.ch !== "&") break;
                            l.a("&").a("&");
                        }

                        return nt;
                    }
                    break;
                case "|":

                    {
                        if (l.pk.ch == "|") {

                            if (or_group || and_group)
                                return term;

                            nt = new OR$$1();

                            nt.terms.push(term);

                            l.sync().next();

                            while (!l.END) {
                                nt.terms.push(d$2(l, definitions, productions, super_term, oneof_group, true, and_group, important));
                                if (l.ch !== "|" || l.pk.ch !== "|") break;
                                l.a("|").a("|");
                            }

                            return nt;

                        } else {

                            if (oneof_group || or_group || and_group)
                                return term;

                            nt = new ONE_OF$$1();

                            nt.terms.push(term);

                            l.next();

                            while (!l.END) {
                                nt.terms.push(d$2(l, definitions, productions, super_term, true, or_group, and_group, important));
                                if (l.ch !== "|") break;
                                l.a("|");
                            }

                            return nt;
                        }
                    }
                    break;
                default:

                    v = (l.ty == l.types.symbol) ? new SymbolTerm$$1(l.tx) : new LiteralTerm$$1(l.tx, l.ty);
                    l.next();
                    v = checkExtensions$1(l, v, productions);

                    if (term) {
                        if (term instanceof JUX$$1 /*&& (term.isRepeating() || term instanceof ONE_OF)*/) term = foldIntoProduction$1(productions, new JUX$$1, term);
                        term = foldIntoProduction$1(productions, term, v);
                    } else {
                        term = v;
                    }
            }
        }

        return term;
    }

    function checkExtensions$1(l, term, productions) {
        outer:
        while (true) {

            switch (l.ch) {
                case "!":
                    /* https://www.w3.org/TR/CSS21/cascade.html#important-rules */
                    term.IMPORTANT = true;
                    l.next();
                    continue outer;
                case "{":
                    term = foldIntoProduction$1(productions, term);
                    term.r[0] = parseInt(l.next().tx);
                    if (l.next().ch == ",") {
                        l.next();
                        if (l.pk.ch == "}") {

                            term.r[1] = parseInt(l.tx);
                            l.next();
                        } else {
                            term.r[1] = Infinity;
                        }
                    } else
                        term.r[1] = term.r[0];
                    l.a("}");
                    break;
                case "*":
                    term = foldIntoProduction$1(productions, term);
                    term.r[0] = 0;
                    term.r[1] = Infinity;
                    l.next();
                    break;
                case "+":
                    term = foldIntoProduction$1(productions, term);
                    term.r[0] = 1;
                    term.r[1] = Infinity;
                    l.next();
                    break;
                case "?":
                    term = foldIntoProduction$1(productions, term);
                    term.r[0] = 0;
                    term.r[1] = 1;
                    l.next();
                    break;
                case "#":
                    term = foldIntoProduction$1(productions, term);
                    term.terms.push(new SymbolTerm(","));
                    term.r[0] = 1;
                    term.r[1] = Infinity;
                    term.REQUIRE_COMMA = true;
                    l.next();
                    if (l.ch == "{") {
                        term.r[0] = parseInt(l.next().tx);
                        term.r[1] = parseInt(l.next().a(",").tx);
                        l.next().a("}");
                    }
                    break;
            }
            break;
        }
        return term;
    }

    function foldIntoProduction$1(productions, term, new_term = null) {
        if (term) {
            if (!(term instanceof productions.JUX)) {
                let nr = new productions.JUX();
                nr.terms.push(term);
                term = nr;
            }
            if (new_term) {
                term.seal();
                term.terms.push(new_term);
            }
            return term;
        }
        return new_term;
    }

    function createCache(cacher){
        let cache = null;
        const destroy = cacher.prototype.destroy;
        const init = cacher.prototype.init;

        cacher.prototype.destroy = function(...args){

            if(destroy)
                destroy.call(this, ...args);

            this.next_cached = cache;
            cache = this;
        };

        return function(...args){
                let r;
            if(cache){
                r = cache;
                cache = cache.next_cached;
                r.next_cached = null;
                init.call(r,...args);
            }else{
                r = new cacher(...args);
                r.next_cached = null;
                r.CACHED = true;
            }
            return r;
        };
    }

    const props = Object.assign({}, property_definitions$1);

    function dragstart$1(e){
        event.dataTransfer.setData('text/plain',null);
        UIProp.dragee = this;
    }

    class UIProp {
        constructor(type,  parent) {
            // Predefine all members of this object.
            this.hash = 0;
            this.type = "";
            this.parent = null;
            this._value = null;
            this.setupElement(type);
            this.init(type, parent);
        }

        init(type,  parent){
            this.type = type;
            this.parent = parent;
        }

        destroy(){
            this.hash = 0;
            this.type = "";
            this.parent = null;
            this._value = null;
            this.type = null;
            this.parent = null;
            this.unmount();
        }

        build(type, value){
            this.element.innerHTML ="";
            this.element.appendChild(this.label);
            let pp = getPropertyParser$1(type, undefined, props, ui_productions);
            this._value = pp.buildInput(1, whind$1(value));
            this._value.parent = this;
            this._value.mount(this.element);
        }

        update(value) {
            this.parent.update(this.type, value.toString());
        }

        mount(element) {
            if (element instanceof HTMLElement)
                element.appendChild(this.element);
        }

        unmount() {
            if (this.element.parentElement)
                this.element.parentElement.removeChild(this.element);
        }

        setupElement(type) {
            this.element = document.createElement("div");
            this.element.setAttribute("draggable", "true");
            this.element.classList.add("prop");
            this.element.addEventListener("dragstart", dragstart$1.bind(this));
            this.label = document.createElement("span");
            this.label.classList.add("prop_label");
            this.label.innerHTML = `${type.replace(/[\-\_]/g, " ")}`;
        }

        get value(){
            return this._value.toString();
        }
    }

    UIProp = createCache(UIProp);

    const props$1 = Object.assign({}, property_definitions$1);

    /**
     * Container for all rules found in a CSS string or strings.
     *
     * @memberof module:wick~internals.css
     * @alias CSSRootNode
     */
    class CSSRootNode {
        constructor() {
            this.promise = null;
            /**
             * Media query selector
             */
            this.pending_build = 0;
            this.resolves = [];
            this.res = null;
            this.observers = [];
            
            this.addChild(new CSSRuleBody());
        }

        _resolveReady_(res, rej) {
            if (this.pending_build > 0) this.resolves.push(res);
            res(this);
        }

        _setREADY_() {
            if (this.pending_build < 1) {
                for (let i = 0, l = this.resolves; i < l; i++) this.resolves[i](this);
                this.resolves.length = 0;
                this.res = null;
            }
        }

        READY() {
            if (!this.res) this.res = this._resolveReady_.bind(this);
            return new Promise(this.res);
        }
        /**
         * Creates a new instance of the object with same properties as the original.
         * @return     {CSSRootNode}  Copy of this object.
         * @public
         */
        clone() {
            let rn = new this.constructor();
            rn._selectors_ = this._selectors_;
            rn._sel_a_ = this._sel_a_;
            rn._media_ = this._media_;
            return rn;
        }

        * getApplicableSelectors(element, win = window) {

            for (let node = this.fch; node; node = this.getNextChild(node)) {

                if(node.matchMedia(win)){
                    let gen = node.getApplicableSelectors(element, win);
                    let v = null;
                    while ((v = gen.next().value))
                        yield v;
                }
            }
        }

        /**
         * Retrieves the set of rules from all matching selectors for an element.
         * @param      {HTMLElement}  element - An element to retrieve CSS rules.
         * @public
         */
        getApplicableRules(element, rule = new CSSRule(), win = window) {
            for (let node = this.fch; node; node = this.getNextChild(node))
                node.getApplicableRules(element, rule, win);
            return rule;
        }

        /**
         * Gets the last rule matching the selector
         * @param      {string}  string  The string
         * @return     {CSSRule}  The combined set of rules that match the selector.
         */
        getRule(string) {
            let r = null;
            for (let node = this.fch; node; node = this.getNextChild(node))
                r = node.getRule(string, r);
            return r;
        }

        toString(off = 0) {
            let str = "";
            for (let node = this.fch; node; node = this.getNextChild(node))
                str += node.toString(off);
            return str;
        }

        addObserver(observer) {
            this.observers.push(observer);
        }

        removeObserver(observer) {
            for (let i = 0; i < this.observers.length; i++)
                if (this.observers[i] == observer) return this.observers.splice(i, 1);
        }

        updated() {
            if (this.observers.length > 0)
                for (let i = 0; i < this.observers.length; i++) this.observers[i].updatedCSS(this);
        }

        parse(lex, root) {
            if (typeof(lex) == "string")
                lex = whind$1(lex);

            if (lex.sl > 0) {

                if (!root && root !== null) {
                    root = this;
                    this.pending_build++;
                }

                return this.fch.parse(lex, this).then(e => {
                    this._setREADY_();
                    this.updated();
                    return this;
                });
            }
        }

        merge(inCSSRootNode){
            if(inCSSRootNode instanceof CSSRootNode){
                
                let children = inCSSRootNode.children;
                outer:
                for(let i = 0; i < children.length; i++){
                    //determine if this child matches any existing selectors
                    let child = children[i];
                    
                    for(let i = 0; i < this.children.length; i++){
                        let own_child = this.children[i];

                        if(own_child.isSame(child)){
                            own_child.merge(child);
                            continue outer;
                        }
                    }

                    this.children.push(child);
                }
            }
        }
    }

    /**
     * CSSRootNode implements all of ll
     * @extends ll
     * @memberof  module:wick~internals.html.CSSRootNode
     * @private
     */
    LinkedList.mixinTree(CSSRootNode);

    /**
     * Builds a CSS object graph that stores `selectors` and `rules` pulled from a CSS string. 
     * @function
     * @param {string} css_string - A string containing CSS data.
     * @param {string} css_string - An existing CSSRootNode to merge with new `selectors` and `rules`.
     * @return {Promise} A `Promise` that will return a new or existing CSSRootNode.
     * @memberof module:wick.core
     * @alias css
     */
    const CSSParser = (css_string, root = null) => (root = (!root || !(root instanceof CSSRootNode)) ? new CSSRootNode() : root, root.parse(whind$1(css_string)));

    CSSParser.types = types;

    const
        CSS_Length$2 = CSSParser.types.length,
        CSS_Percentage$2 = CSSParser.types.percentage,
        CSS_Color$2 = CSSParser.types.color,
        CSS_Transform2D$2 = CSSParser.types.transform2D,
        CSS_Path$2 = CSSParser.types.path,
        CSS_Bezier$2 = CSSParser.types.cubic_bezier,

        Animation = (function anim() {

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

            const Linear = { getYatX: x => x, toString: () => "linear" };


            // Class to linearly interpolate number.
            class lerpNumber extends Number { lerp(to, t, from = 0) { return this + (to - this) * t; } copy(val) { return new lerpNumber(val); } }
            class lerpNonNumeric { constructor(v) { this.v = v; } lerp(to, t) { return to.v } copy(val) { return new lerpNonNumeric(val) } }


            // Store animation data for a single property on a single object. Hosts methods that can create CSS based interpolation and regular JS property animations. 
            class AnimProp {

                constructor(keys, obj, prop_name, type) {

                    this.duration = 0;
                    this.end = false;
                    this.keys = [];
                    this.current_val = null;

                    let IS_ARRAY = Array.isArray(keys);

                    if (prop_name == "transform")
                        this.type = CSS_Transform2D$2;
                    else {
                        this.type = (IS_ARRAY) ? this.getType(keys[0].value || keys[0].v) : this.getType(keys.value || keys.v);
                    }

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

                        if (this.type == CSS_Percentage$2) {
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
                    switch (typeof(value)) {
                        case "number":
                            return lerpNumber;
                            break
                        case "string":
                            if (CSS_Length$2._verify_(value))
                                return CSS_Length$2;
                            if (CSS_Percentage$2._verify_(value))
                                return CSS_Percentage$2;
                            if (CSS_Color$2._verify_(value))
                                return CSS_Color$2;
                            //intentional
                        case "object":
                            return lerpNonNumeric;
                    }
                }

                addKey(key, prev) {
                    let
                        l = this.keys.length,
                        pkey = this.keys[l - 1],
                        v = (key.value !== undefined) ? key.value : key.v,
                        own_key = {
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

                getValueAtTime(time = 0) {
                    let val_start = this.current_val,
                        val_end = this.current_val,
                        key, val_out = val_start;


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
                                val_out = val_start.lerp(val_end, s, val_start);
                            }
                        } else {
                            val_out = val_end;
                        }
                    }

                    return val_out;
                }

                run(obj, prop_name, time, type) {
                    const val_out = this.getValueAtTime(time);
                    this.setProp(obj, prop_name, val_out, type);
                    return time < this.duration;
                }

                setProp(obj, prop_name, value, type) {

                    if (type == CSS_STYLE) {
                        obj.style[prop_name] = value;
                    } else
                        obj[prop_name] = value;
                }

                unsetProp(obj, prop_name) {
                    this.setProp(obj, prop_name, "", CSS_STYLE);
                }

                toCSSString(time = 0, prop_name = "") {
                    const value = this.getValueAtTime(time);
                    return `${prop_name}:${value.toString()}`;
                }
            }

            // Stores animation data for a group of properties. Defines delay and repeat.
            class AnimSequence {
                constructor(obj, props) {
                    this.duration = 0;
                    this.time = 0;
                    this.obj = null;
                    this.type = setType(obj);
                    this.DESTROYED = false;
                    this.FINISHED = false;
                    this.CSS_ANIMATING = false;
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

                // Removes AnimProps based on object of keys that should be removed from this sequence.
                removeProps(props) {
                    if (props instanceof AnimSequence)
                        props = props.props;

                    for (let name in props) {
                        if (this.props[name])
                            this.props[name] = null;
                    }
                }


                unsetProps(props) {
                    for (let name in this.props)
                        this.props[name].unsetProp(this.obj, name);
                }

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
                        this.duration = Math.max(prop.duration || prop.dur, this.duration);
                    } else {
                        prop = new AnimProp(keys, this.obj, name, this.type);
                        this.props[name] = prop;
                        this.duration = Math.max(prop.duration || prop.dur, this.duration);
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
                        spark.queueUpdate(this);
                    else
                        this.issueEvent("stopped");
                }

                play(from = 0) {
                    this.time = from;
                    spark.queueUpdate(this);
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

                toCSSString(keyfram_id) {

                    const strings = [`.${keyfram_id}{animation:${keyfram_id} ${this.duration}ms ${Animation.ease_out.toString()}}`, `@keyframes ${keyfram_id}{`];

                    // TODO: Use some function to determine the number of steps that should be taken
                    // This should reflect the different keyframe variations that can occure between
                    // properties.
                    // For now, just us an arbitrary number

                    const len = 2;
                    const len_m_1 = len - 1;
                    for (let i = 0; i < len; i++) {

                        strings.push(`${Math.round((i/len_m_1)*100)}%{`);

                        for (let name in this.props)
                            strings.push(this.props[name].toCSSString((i / len_m_1) * this.duration, name.replace(/([A-Z])/g, (match, p1) => "-" + match.toLowerCase())) + ";");

                        strings.push("}");
                    }

                    strings.push("}");

                    return strings.join("\n");
                }

                beginCSSAnimation() {
                    if (!this.CSS_ANIMATING) {

                        const anim_class = "class" + ((Math.random() * 10000) | 0);
                        this.CSS_ANIMATING = anim_class;

                        this.obj.classList.add(anim_class);
                        let style = document.createElement("style");
                        style.innerHTML = this.toCSSString(anim_class);
                        document.head.appendChild(style);
                        this.style = style;

                        setTimeout(this.endCSSAnimation.bind(this), this.duration);
                    }
                }

                endCSSAnimation() {
                    if (this.CSS_ANIMATING) {
                        this.obj.classList.remove(this.CSS_ANIMATING);
                        this.CSS_ANIMATING = "";
                        this.style.parentElement.removeChild(this.style);
                        this.style = null;
                    }
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
                    this.time += t;
                    if (this.run(this.time))
                        spark.queueUpdate(this);
                }

                play(from = 0) {
                    this.time = 0;
                    spark.queueUpdate(this);
                }
            }

            const GlowFunction = function() {

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
            };

            Object.assign(GlowFunction, {

                createSequence: GlowFunction,

                createGroup: function(...rest) {
                    let group = new AnimGroup;
                    rest.forEach(seq => group.add(seq));
                    return group;
                },

                set USE_TRANSFORM(v) { USE_TRANSFORM = !!v; },
                get USE_TRANSFORM() { return USE_TRANSFORM; },

                linear: Linear,
                ease: new CSS_Bezier$2(0.25, 0.1, 0.25, 1),
                ease_in: new CSS_Bezier$2(0.42, 0, 1, 1),
                ease_out: new CSS_Bezier$2(0.2, 0.8, 0.3, 0.99),
                ease_in_out: new CSS_Bezier$2(0.42, 0, 0.58, 1),
                overshoot: new CSS_Bezier$2(0.2, 1.5, 0.2, 0.8),
                custom: (x1, y1, x2, y2) => new CSS_Bezier$2(x1, y1, x2, y2)
            });

            return GlowFunction;
        })();

    const CSS_Transform2D$3 = CSSParser.types.transform2D;

    function setTo(to, seq, duration, easing, from){

        const cs = window.getComputedStyle(to, null);
        const rect = to.getBoundingClientRect();
        const from_rect = from.getBoundingClientRect();

        let to_width = cs.getPropertyValue("width");
        let to_height = cs.getPropertyValue("height");
        let margin_left = parseFloat(cs.getPropertyValue("margin-left"));
        let to_bgc = cs.getPropertyValue("background-color");
        let to_c = cs.getPropertyValue("color");
        const pos = cs.getPropertyValue("position");

        /* USING TRANSFORM */

        //Use width and height a per

        {
            ////////////////////// LEFT ////////////////////// 

            const left = seq.props.left;
            let start_left = 0, final_left = 0, abs_diff = 0;

            abs_diff = (left.keys[0].val - rect.left);

            if(pos== "relative"){
                //get existing offset 
                const left = parseFloat(cs.getPropertyValue("left")) || 0;

                start_left = abs_diff +left;
                final_left = left;
            }else{
                start_left = to.offsetLeft + abs_diff;
                final_left = to.offsetLeft;
            }

            left.keys[0].val = new left.type(start_left, "px");
            left.keys[1].val = new left.type(final_left,"px");
            left.keys[1].dur = duration;
            left.keys[1].len = duration;
            left.keys[1].ease = easing;
            left.duration = duration;

            ////////////////////// TOP ////////////////////// 
            const top = seq.props.top;
            let start_top = 0, final_top = 0;

            abs_diff = (top.keys[0].val - rect.top);

            if(pos== "relative"){
                 const top = parseFloat(cs.getPropertyValue("top")) || 0;
                start_top = abs_diff + top;
                final_top = top;
            }else{
                start_top = to.offsetTop + abs_diff;
                final_top = to.offsetTop;
            }

            top.keys[0].val = new top.type(start_top, "px");
            top.keys[1].val = new top.type(final_top,"px");
            top.keys[1].dur = duration;
            top.keys[1].len = duration;
            top.keys[1].ease = easing;
            top.duration = duration;

            ////////////////////// WIDTH ////////////////////// 

            seq.props.width.keys[0].val = new seq.props.width.type(to_width);
            seq.props.width.keys[0].dur = duration;
            seq.props.width.keys[0].len = duration;
            seq.props.width.keys[0].ease = easing;
            seq.props.width.duration = duration;

            ////////////////////// HEIGHT ////////////////////// 

            seq.props.height.keys[0].val = new seq.props.height.type(to_height);
            seq.props.height.keys[0].dur = duration;
            seq.props.height.keys[0].len = duration; 
            seq.props.height.keys[0].ease = easing; 
            seq.props.height.duration = duration;

        }
            to.style.transformOrigin = "top left";

        ////////////////////// BG COLOR ////////////////////// 

        seq.props.backgroundColor.keys[0].val = new seq.props.backgroundColor.type(to_bgc);
        seq.props.backgroundColor.keys[0].dur = duration; 
        seq.props.backgroundColor.keys[0].len = duration; 
        seq.props.backgroundColor.keys[0].ease = easing; 
        seq.props.backgroundColor.duration = duration;

        ////////////////////// COLOR ////////////////////// 

        seq.props.color.keys[0].val = new seq.props.color.type(to_c);
        seq.props.color.keys[0].dur = duration; 
        seq.props.color.keys[0].len = duration; 
        seq.props.color.keys[0].ease = easing; 
        seq.props.color.duration = duration;

        seq.obj = to;



        seq.addEventListener("stopped", ()=>{
            seq.unsetProps();
        });
    }

    /**
        Transform one element from another back to itself
        @alias module:wick~internals.TransformTo
    */
    function TransformTo(element_from, element_to, duration = 500, easing = Animation.linear, HIDE_OTHER = false) {
        let rect = element_from.getBoundingClientRect();
        let cs = window.getComputedStyle(element_from, null);
        let margin_left = parseFloat(cs.getPropertyValue("margin"));

        let seq = Animation.createSequence({
            obj: element_from,
            // /transform: [{value:"translate(0,0)"},{value:"translate(0,0)"}],
            width: { value: "0px"},
            height: { value: "0px"},
            backgroundColor: { value: "rgb(1,1,1)"},
            color: { value: "rgb(1,1,1)"},
            left: [{value:rect.left+"px"},{ value: "0px"}],
            top: [{value:rect.top+"px"},{ value: "0px"}]
        });

        if (!element_to) {

            let a = (seq) => (element_to, duration = 500, easing = Animation.linear,  HIDE_OTHER = false) => {
                setTo(element_to, seq, duration, easing, element_from);
                seq.duration = duration;
            console.log(seq.toCSSString("MumboJumbo"));
                return seq;
            };

            return a(seq);
        }

        setTo(element_to, duration, easing, element_from);
        seq.duration = duration;
        return seq;
    }

    const Transitioneer = (function() {

        let obj_map = new Map();

        function $in(anim_data_or_duration = 0, delay = 0) {

            let seq;

            if (typeof(anim_data_or_duration) == "object") {
                if (anim_data_or_duration.match && this.TT[anim_data_or_duration.match]) {
                    let duration = anim_data_or_duration.duration;
                    let easing = anim_data_or_duration.easing;
                    seq = this.TT[anim_data_or_duration.match](anim_data_or_duration.obj, duration, easing);
                } else
                    seq = Animation.createSequence(anim_data_or_duration);

                //Parse the object and convert into animation props. 
                if (seq) {
                    this.in_seq.push(seq);
                    this.in_duration = Math.max(this.in_duration, seq.duration);
                    if (this.OVERRIDE) {

                        if (obj_map.get(seq.obj)) {
                            let other_seq = obj_map.get(seq.obj);
                            other_seq.removeProps(seq);
                        }

                        obj_map.set(seq.obj, seq);
                    }
                }

            } else
                this.in_duration = Math.max(this.in_duration, parseInt(delay) + parseInt(anim_data_or_duration));

            return this.in;
        }


        function $out(anim_data_or_duration = 0, delay = 0, in_delay = 0) {
            //Every time an animating component is added to the Animation stack delay and duration need to be calculated.
            //The highest in_delay value will determine how much time is afforded before the animations for the in portion are started.

            if (typeof(anim_data_or_duration) == "object") {

                if (anim_data_or_duration.match) {
                    this.TT[anim_data_or_duration.match] = TransformTo(anim_data_or_duration.obj);
                } else {
                    let seq = Animation.createSequence(anim_data_or_duration);
                    if (seq) {
                        this.out_seq.push(seq);
                        this.out_duration = Math.max(this.out_duration, seq.duration);
                        if (this.OVERRIDE) {

                            if (obj_map.get(seq.obj)) {
                                let other_seq = obj_map.get(seq.obj);
                                other_seq.removeProps(seq);
                            }

                            obj_map.set(seq.obj, seq);
                        }
                    }
                    this.in_delay = Math.max(this.in_delay, parseInt(delay));
                }
            } else {
                this.out_duration = Math.max(this.out_duration, parseInt(delay) + parseInt(anim_data_or_duration));
                this.in_delay = Math.max(this.in_delay, parseInt(in_delay));
            }
        }



        class Transition {
            constructor(override = true) {
                this.in_duration = 0;
                this.out_duration = 0;
                this.PLAY = true;

                this.reverse = false;

                this.time = 0;

                // If set to zero transitions for out and in will happen simultaneously.
                this.in_delay = 0;

                this.in_seq = [];
                this.out_seq = [];

                this.TT = {};

                this.out = $out.bind(this);
                this.in = $in.bind(this);

                Object.defineProperty(this.out, "out_duration", {
                    get: () => this.out_duration
                });

                this.OVERRIDE = override;
            }

            destroy() {
                let removeProps = function(seq) {

                    if (!seq.DESTROYED) {
                        if (obj_map.get(seq.obj) == seq)
                            obj_map.delete(seq.obj);
                    }

                    seq.destroy();
                };
                this.in_seq.forEach(removeProps);
                this.out_seq.forEach(removeProps);
                this.in_seq.length = 0;
                this.out_seq.length = 0;
                this.res = null;
                this.out = null;
                this.in = null;
            }

            get duration() {
                return Math.max(this.in_duration + this.in_delay, this.out_duration);
            }


            start(time = 0, speed = 1, reverse = false) {

                for (let i = 0; i < this.in_seq.length; i++) {
                    let seq = this.in_seq[i];
                    seq.beginCSSAnimation();
                }

                this.time = time;
                this.speed = Math.abs(speed);
                this.reverse = reverse;

                if (this.reverse)
                    this.speed = -this.speed;
                return
                return new Promise((res, rej) => {
                    if (this.duration > 0)
                        this.scheduledUpdate(0, 0);
                    if (this.duration < 1)
                        return res();
                    this.res = res;
                });
            }

            play(t) {
                this.PLAY = true;
                let time = this.duration * t;
                this.step(time);
                return time;
            }

            stop() {
                this.PLAY = false;
                //There may be a need to kill any existing CSS based animations
            }

            step(t) {
                for (let i = 0; i < this.out_seq.length; i++) {
                    let seq = this.out_seq[i];
                    if(!seq.run(t) && !seq.FINISHED){
                        seq.issueEvent("stopped");
                        seq.FINISHED = true;
                    }
                }

                t = Math.max(t - this.in_delay, 0);

                for (let i = 0; i < this.in_seq.length; i++) {
                    let seq = this.in_seq[i];
                    if(!seq.run(t) && !seq.FINISHED){
                        seq.issueEvent("stopped");
                        seq.FINISHED = true;
                    }
                }

            }

            scheduledUpdate(step, time) {
                if (!this.PLAY) return;

                this.time += time * this.speed;

                this.step(this.time);


                if (this.res && this.time >= this.in_delay) {
                    this.res();
                    this.res = null;
                }

                if (this.reverse) {
                    if (this.time > 0)
                        return spark.queueUpdate(this);
                } else {
                    if (this.time < this.duration)
                        return spark.queueUpdate(this);
                }

                if (this.res)
                    this.res();

                this.destroy();
            }
        }

        return { createTransition: (OVERRIDE) => new Transition(OVERRIDE) };
    })();

    Object.assign(Animation, {
    	createTransition:(...args) => Transitioneer.createTransition(...args),
    	transformTo:(...args) => TransformTo(...args)
    });

    return Animation;

}());
