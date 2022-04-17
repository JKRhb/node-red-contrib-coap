# node-red-contrib-coap

[![Build Status](https://github.com/JKRhb/node-red-contrib-coap/actions/workflows/npm-test.yml/badge.svg?event=release)](https://github.com/JKRhb/node-red-contrib-coap/actions/workflows/npm-test.yml)
[![platform](https://img.shields.io/badge/platform-Node--RED-red)](https://flows.nodered.org/node/node-red-contrib-coap)
[![NPM version](https://badge.fury.io/js/node-red-contrib-coap.svg)](https://www.npmjs.com/package/node-red-contrib-coap)
[![Coverage Status](https://coveralls.io/repos/github/JKRhb/node-red-contrib-coap/badge.svg?branch=main)](https://coveralls.io/github/JKRhb/node-red-contrib-coap?branch=main)
[![NPM](https://img.shields.io/npm/l/node-red-contrib-coap)](https://github.com/JKRhb/node-red-contrib-coap/blob/main/LICENSE)

This project adds CoAP support to [Node-RED](http://nodered.org/). It is based on Matteo Collina's [node-coap](https://github.com/mcollina/node-coap).

## Functionality

We introduce "coap request", "coap in", and "coap response" nodes which can be used in a similar fashion to "http request", "http in", and "http reponse" nodes from Node-RED's core.

## Requirements

This module requires at least Node version 12.
This might require you to upgrade the pre-installed Node version on platforms like Beaglebone.

## Install

```bash
cd $NODE_RED_HOME
npm install node-red-contrib-coap
```

## Install from Source

```bash
cd $NODE_RED_HOME/nodes
git clone https://github.com/JKRhb/node-red-contrib-coap.git
cd ./node-red-contrib-coap
npm install
```

## Examples
You can check out a couple of usage examples at *./examples* directory of this repo.
