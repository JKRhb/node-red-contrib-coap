module.exports = function (RED) {
    "use strict";
    const coap = require("coap");
    const cbor = require("cbor");
    const linkFormat = require("h5.linkformat");

    function _checkContentFormat(contentFormat, expectedContentFormat) {
        return typeof contentFormat === "string" && contentFormat.includes(expectedContentFormat);
    }

    // A node red node that sets up a local coap server
    function CoapServerNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        node._inputNodes = []; // collection of "coap in" nodes that represent coap resources

        // Setup node-coap server and start
        const serverSettings = {};
        if (config.ipv6) {
            serverSettings.type = "udp6";
        } else {
            serverSettings.type = "udp4";
        }
        node.server = new coap.createServer(serverSettings);
        node.server.on("request", function (req, res) {
            node.handleRequest(req, res);
            res.on("error", function (err) {
                node.log("server error");
                node.log(err);
            });
        });
        node.server.listen(config.port, function () {
            node.log("CoAP Server Started");
        });

        node.on("close", function () {
            node._inputNodes = [];
            node.server.close();
        });
    }
    RED.nodes.registerType("coap-server", CoapServerNode);

    CoapServerNode.prototype.registerInputNode = function (inputNode) {
        var node = this;
        let exists = false;
        for (let i = 0; i < node._inputNodes.length; i++) {
            if (
                node._inputNodes[i].options.url == inputNode.options.url &&
                node._inputNodes[i].options.method == inputNode.options.method
            ) {
                exists = true;

                //TODO: Does this have any effect? Should show the error in the frontend somehow? Some kind of status bar?
                node.error(
                    "Node with the specified URL and Method already exists!"
                );
            }
        }
        if (!exists) {
            node._inputNodes.push(inputNode);
        }
    };

    function _getPayload(inNode, rawBuffer, payload, contentFormat) {
        if (rawBuffer) {
            return payload;
        } else if (_checkContentFormat(contentFormat, "text/plain")) {
            return payload;
        } else if (_checkContentFormat(contentFormat, "json")) {
            return JSON.parse(payload.toString());
        } else if (_checkContentFormat(contentFormat, "cbor")) {
            cbor.decodeAll(payload, function (err, decodedPayload, req, res) {
                if (err) {
                    inNode.error(err);
                }
                return decodedPayload[0];
            });
        } else if (_checkContentFormat(contentFormat, "application/link-format")) {
            return linkFormat.parse(payload.toString());
        } else {
            return payload;
        }
    }

    function _onRequest(inNode, req, res) {
        const contentFormat = req.headers["Content-Format"];
        const payload = _getPayload(inNode, inNode.options.rawBuffer, req.payload, contentFormat);

        inNode.send({
            payload,
            contentFormat,
            req,
            res
        });
    }

    CoapServerNode.prototype.handleRequest = function (req, res) {
        //TODO: Check if there are any matching resource. If the resource is .well-known return the resource directory to the client
        const node = this;
        let matchResource = false;
        let matchMethod = false;
        for (let i = 0; i < node._inputNodes.length; i++) {
            if (node._inputNodes[i].options.url == req.url) {
                matchResource = true;
                if (node._inputNodes[i].options.method == req.method) {
                    matchMethod = true;
                    const inNode = node._inputNodes[i];
                    _onRequest(inNode, req, res);
                }
            }
        }
        if (!matchResource) {
            res.code = "4.04";
            return res.end();
        }

        if (!matchMethod) {
            res.code = "4.05";
            return res.end();
        }
    };

    function CoapInNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        node.options = {};
        node.options.method = config.method;
        node.options.name = config.name;
        node.options.server = config.server;
        node.options.url = config.url.charAt(0) == "/" ? config.url : "/" + config.url;

        const serverConfig = RED.nodes.getNode(config.server);

        if (serverConfig != null) {
            serverConfig.registerInputNode(node);
        } else {
            node.error("Missing server configuration");
        }
    }
    RED.nodes.registerType("coap in", CoapInNode);

    function _constructPayload(msg, contentFormat) {
        const payload = msg.payload;

        if (payload == null) {
            return null;
        }

        if (_checkContentFormat(contentFormat, "text/plain")) {
            return msg.payload;
        } else if (_checkContentFormat(contentFormat, "json")) {
            return JSON.stringify(msg.payload);
        } else if (_checkContentFormat(contentFormat, "cbor")) {
            return cbor.encode(msg.payload);
        } else {
            return msg.payload;
        }
    }

    function CoapOutNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        node.options = {
            name: config.name,
            code: config.statusCode,
            contentFormat: config.contentFormat
        };

        this.on("input", function (msg, _send, done) {
            let code = this.options.code || msg.statusCode || "2.05";
            // TODO: Improve contentFormat system
            const contentFormat = msg.contentFormat || node.options.contentFormat;
            const payload = _constructPayload(msg, contentFormat);

            if (msg.res) {
                msg.res.code = code;
                if (contentFormat != null) {
                    msg.res.setOption("Content-Format", contentFormat);
                }

                msg.res.on("error", function (err) {
                    node.log("server error");
                    node.log(err);
                });

                if (payload != null) {
                    msg.res.write(payload);
                }

                msg.res.end();
            } else {
                node.error("No response found in input node!");
            }

            done();
        });
    }
    RED.nodes.registerType("coap response", CoapOutNode);
};
