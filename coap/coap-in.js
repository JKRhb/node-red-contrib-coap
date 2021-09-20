module.exports = function (RED) {
    "use strict";
    var coap = require("coap");

    // A node red node that sets up a local coap server
    function CoapServerNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        node._inputNodes = []; // collection of "coap in" nodes that represent coap resources

        // Setup node-coap server and start
        var serverSettings = {};
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
        var exists = false;
        for (var i = 0; i < this._inputNodes.length; i++) {
            if (
                this._inputNodes[i].options.url == inputNode.options.url &&
                this._inputNodes[i].options.method == inputNode.options.method
            ) {
                exists = true;

                //TODO: Does this have any effect? Should show the error in the frontend somehow? Some kind of status bar?
                this.error(
                    "Node with the specified URL and Method already exists!"
                );
            }
        }
        if (!exists) {
            this._inputNodes.push(inputNode);
        }
    };

    CoapServerNode.prototype.handleRequest = function (req, res) {
        //TODO: Check if there are any matching resource. If the resource is .well-known return the resource directory to the client
        var matchResource = false;
        var matchMethod = false;
        for (var i = 0; i < this._inputNodes.length; i++) {
            if (this._inputNodes[i].options.url == req.url) {
                matchResource = true;
                if (this._inputNodes[i].options.method == req.method) {
                    matchMethod = true;
                    var inNode = this._inputNodes[i];
                    inNode.send({ req: req, res: res });
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

        var serverConfig = RED.nodes.getNode(config.server);

        if (serverConfig) {
            serverConfig.registerInputNode(node);
        } else {
            node.error("Missing server configuration");
        }
    }
    RED.nodes.registerType("coap in", CoapInNode);
};
