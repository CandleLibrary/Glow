import glow from "../source/glow.mjs";

const chai = require("chai");
chai.should();

const path = require("path");
const fs = require("fs");

global.HTMLElement = function(){}

describe("CFW Glow - Animation Tests On JS properties", () => {

    describe("Base Animations", function(){
    	this.slow(5000);


        it("Animates numeric properties of JS objects", async () => {
            let obj = {prop:0};
            let animation = glow({obj:obj, prop:[{v:1, dur:1000}]})
            animation.play();

            await (new Promise((res)=>{
            	setTimeout(()=>{
            		//Rounding due to timing variances with setTimeout
            		Math.floor(obj.prop*10).should.equal(5)
            	}, 501)

            	setTimeout(()=>{
            		//Rounding due to timing variances with setTimeout
            		Math.floor(obj.prop*10).should.equal(10)
            		res();	
            	}, 1001)

            }))
        })

        it("Animates non-numeric properties of JS objects using step interpolotion", async () => {
        	let obj = {prop:"Thom"};
            let animation = glow({obj:obj, prop:[{v:"Jake", dur:200}, {v:"Thumb", dur:400}, {v:obj, dur:400}]})
            animation.play();

            await (new Promise((res)=>{
            	setTimeout(()=>{
            		obj.prop.should.equal("Jake")
            	}, 150)

            	setTimeout(()=>{
            		obj.prop.should.equal("Thumb")
            	}, 500)

            	setTimeout(()=>{
            		obj.prop.should.equal(obj)
            		res();	
            	}, 1001)

            }))
        })
        it("Animates array numeric members", async () => {

        })
    })
})
