import commonjs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';

export default {
    input: "./source/glow",
    treeshake: true,
    output: [{
    	name:"glow",
        file: "./build/glow.node.js",
        format: "cjs",
        exports:"named"
    }, {
    	name:"glow",
        file: "./build/glow.js",
        format: "iife",
        exports:"named"
    }],
    plugins: [commonjs({ include: ['./node_modules/*.*'] }), resolve()]
};