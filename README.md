<h1 align=center>CandleLibrary Glow</h1>

<h3 align=center>Animation Library</h3>

<p align=center> <sub><b>v0.3.0</b></sub> </p>

# BRIEF
### TODO - FILL THIS IN! 
```ts


import {addModuleToCFW} from "@candlelib/candle";

import {Animation} from "./animation.js";

import {Transitioneer} from "./transitioneer.js";

import {TransformTo} from "./transformto.js";

Object.assign(

    Animation,

    {

        createTransition:Transitioneer.createTransition,

        transformTo:TransformTo
    }
);

addModuleToCFW(Animation, "glow");

export default Animation;
```

# INSTALL

#### npm
```bash
$ npm install --save @candlelib/glow
```
#### yarn
```bash
$ yarn add @candlelib/glow
```

# DOCS
[Docs](https://cfw.acweathersby.com/glow)

# CFW DEPENDENCIES

As a part of CandleLibrary, cfw.glow relies on the following libraries to make the magic happen. 
The modular design of CFW allows each on to be used independently for specific project needs. 
Give them a look to find out more. 

- [cfw](https://github.com/CandleLibrary/cfw)
- [css](https://github.com/CandleLibrary/css)
- [math](https://github.com/CandleLibrary/math)
- [spark](https://github.com/CandleLibrary/spark)