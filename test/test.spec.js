import glow from "../build/library/glow.js";
import spark from "@candlelib/spark";

global.HTMLElement = function () { };

assert_group("Animates numeric properties of JS objects", sequence, () => {

    let obj = { prop: 0 };

    let animation = glow({ obj: obj, prop: [{ v: 1000, dur: 200, easing: glow.linear }] });

    animation.play();

    const t = spark.frame_time;

    await spark.sleep(100);

    assert(Math.floor(obj.prop) > 400);

    assert(Math.floor(obj.prop) < 650);

    await spark.sleep(200);

    assert(Math.floor(obj.prop) >= 900);


});
assert_group("Animates non-numeric properties of JS objects using stepped interpolation", () => {
    let obj = { prop: "Thom" };
    let animation = glow({ obj, prop: [{ v: "Jake", dur: 50 }, { v: "Thumb", dur: 100 }, { v: obj, dur: 150 }] });

    animation.play();

    await spark.sleep(52);

    assert(obj.prop == "Jake");

    await spark.sleep(160);

    assert(obj.prop == "Thumb");

    await spark.sleep(300);

    assert(obj.prop == obj);
});