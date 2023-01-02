const defaultCoapPort = 5683;

module.exports = function (RED) {
    "use strict";

    var coap = require("coap");
    var cbor = require("cbor");
    var linkFormat = require("h5.linkformat");

    function CoapRequestNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        function _constructPayload(msg, contentFormat) {
            var payload = null;

            if (contentFormat === "text/plain") {
                payload = msg.payload;
            } else if (contentFormat === "application/json") {
                payload = JSON.stringify(msg.payload);
            } else if (contentFormat === "application/cbor") {
                payload = cbor.encode(msg.payload);
            }

            return payload;
        }

        /**
         * Cleans up the hostname of the passed in `URL` object if it should
         * be an IPv6 address and returns the result.
         *
         * @param {URL} url
         * @returns The cleaned up hostname.
         */
        function _determineHostname(url) {
            const hostname = url.hostname;
            if (hostname.startsWith("[") && hostname.endsWith("]")) {
                return hostname.substring(1, hostname.length - 1);
            }

            return hostname;
        }

        function _determinePort(url) {
            const port = parseInt(url.port);
            if (isNaN(port)) {
                return defaultCoapPort;
            }

            return port;
        }

        function _makeRequest(msg) {
            const url = new URL(config.url || msg.url);
            const hostname = _determineHostname(url);
            const port = _determinePort(url);

            const reqOpts = {
                hostname,
                pathname: url.pathname,
                port,
                query: url.search.substring(1),
            };
            reqOpts.method = (
                config.method ||
                msg.method ||
                "GET"
            ).toUpperCase();
            reqOpts.headers = {};
            reqOpts.headers["Content-Format"] = config["content-format"];
            reqOpts.multicast = config.multicast;
            reqOpts.multicastTimeout = config.multicastTimeout;
            reqOpts.confirmable = msg.confirmable;

            if (reqOpts.confirmable == null) {

                reqOpts.confirmable = config.confirmable;
            }

            function _onResponse(res) {
                function _send(payload) {
                    node.send(
                        Object.assign({}, msg, {
                            payload: payload,
                            headers: res.headers,
                            statusCode: res.code,
                        })
                    );
                }

                function _onResponseData(data) {
                    if (config["raw-buffer"]) {
                        _send(data);
                    } else if (res.headers["Content-Format"] === "text/plain") {
                        _send(data.toString());
                    } else if (
                        res.headers["Content-Format"] === "application/json"
                    ) {
                        try {
                            _send(JSON.parse(data.toString()));
                        } catch (error) {
                            node.error(error.message);
                        }
                    } else if (
                        res.headers["Content-Format"] === "application/cbor"
                    ) {
                        cbor.decodeAll(data, function (err, data) {
                            if (err) {
                                return false;
                            }
                            _send(data[0]);
                        });
                    } else if (
                        res.headers["Content-Format"] ===
                        "application/link-format"
                    ) {
                        _send(linkFormat.parse(data.toString()));
                    } else {
                        _send(data.toString());
                    }
                }

                res.on("data", _onResponseData);

                if (reqOpts.observe) {
                    node.stream = res;
                }
            }

            var payload = _constructPayload(msg, config["content-format"]);

            if (config.observe === true) {
                reqOpts.observe = true;
            } else {
                delete reqOpts.observe;
            }

            //TODO: should revisit this block
            if (node.stream) {
                node.stream.close();
            }

            var req = coap.request(reqOpts);
            req.on("response", _onResponse);
            req.on("error", function (err) {
                node.log("client error");
                node.log(err);
            });

            if (payload) {
                req.write(payload);
            }
            req.end();
        }

        this.on("input", function (msg) {
            _makeRequest(msg);
        });
    }
    RED.nodes.registerType("coap request", CoapRequestNode);
};
