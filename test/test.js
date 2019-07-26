import glow from "../source/glow.js";
import spark from "@candlefw/spark";
const chai = require("chai");
chai.should();

const path = require("path");
const fs = require("fs");

global.HTMLElement = function(){}

describe("CFW Glow - Animation Tests On JS properties", () => {

    describe("Base Animations", function(){
    	this.slow(5000);


        it("Animates numeric properties of JS objects",  async () => {
            let obj = {prop:0};
            let animation = glow({obj:obj, prop:[{v:1000, dur:200, easing:glow.linear}]})
            animation.play();

            const t = spark.frame_time;

            await spark.sleep(100);

        	//Rounding due to timing variances with setTimeout
        	Math.floor(obj.prop).should.be.within(480,520)


            await spark.sleep(100);
        	//Rounding due to timing variances with setTimeout
        	Math.floor(obj.prop).should.equal(1000)


        })

        it("Animates non-numeric properties of JS objects using stepped interpolation",  async function() {
        	let obj = {prop:"Thom"};
            let animation = glow({obj, prop:[{v:"Jake", dur:50}, {v:"Thumb", dur:100}, {v:obj, dur:150}]})
            
            animation.play();

            await spark.sleep(52);
        	
            obj.prop.should.equal("Jake")
        	
            await spark.sleep(160);

        	obj.prop.should.equal("Thumb")

            await spark.sleep(300);
        	
        	obj.prop.should.equal(obj);
        })
        it("Animates array numeric members", async () => {

        })
    })
})
