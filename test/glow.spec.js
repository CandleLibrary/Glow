import glow from "../build/library/glow.js";

assert_group("Basic single object sequence.", sequence, () => {
    const obj = { test: 2 };

    const anim = await glow({
        obj,
        test: [{ v: 0, dur: 200 }, { v: 0.05, dur: 200 }, { v: 20, dur: 200 }, { v: 50, dur: 200 }]
    });

    await anim.asyncPlay();

    assert(obj.test == 50);

    anim.step(0.50);

    assert(obj.test == 0.05);
});