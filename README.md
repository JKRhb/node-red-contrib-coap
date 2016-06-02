node-red-contrib-coap
=====================
[![Build Status](https://travis-ci.org/reederz/node-red-contrib-coap.png)](https://travis-ci.org/reederz/node-red-contrib-coap) [![Coverage Status](https://coveralls.io/repos/reederz/node-red-contrib-coap/badge.png)](https://coveralls.io/r/reederz/node-red-contrib-coap)
[![Dependency Status](https://david-dm.org/reederz/node-red-contrib-coap.png)](https://david-dm.org/reederz/node-red-contrib-coap)
[![Dev Dependency Status](https://david-dm.org/reederz/node-red-contrib-coap/dev-status.png)](https://david-dm.org/reederz/node-red-contrib-coap#dev-badge-embed)

This project adds CoAP support to [Node-RED](http://nodered.org/). It is based on Matteo Collina's [node-coap](https://github.com/mcollina/node-coap).

Functionality
-------------
 We introduce "coap request" and "coap in" nodes which can be used in a similar fashion to "http request"and "http in" nodes from Node-RED's core.

Install
-------

```bash
cd $NODE_RED_HOME
npm install node-red-contrib-coap
```

Install from Source
-------------------

```bash
cd $NODE_RED_HOME/nodes
git clone https://github.com/reederz/node-red-contrib-coap.git
cd ./node-red-contrib-coap
npm install
```

Examples
--------
You can check out a couple of usage examples at *./examples* directory of this repo.


Contributing
------------
I'm not actively developing *node-red-contrib-coap* at the moment, so please contact me, if you want to take over the development of this package or otherwise contribute - **Justas Azna / 2015-05-15**
