const defaultCoapPort = 5683;

module.exports = function (RED) {
    "use strict";

    var coap = require("coap");
    var cbor = require("cbor");
    var linkFormat = require("h5.linkformat");

    function CoapRequestNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        var paytoqs = config.paytoqs || "ignore";

        function _stringifyParams(params) {
            var paramList = [];
            for (var [key, value] of Object.entries(params)) {
                var dataType = typeof value;
                if (["string", "number"].includes(dataType)) {
                    paramList.push(`${key}=${value}`);
                }
            }

            return paramList.join("&");
        }

        function _appendQueryParams(reqOpts, payload) {
            if (typeof payload === "object") {
                var newParams = _stringifyParams(payload);
                if (newParams && reqOpts.query !== "") {
                    newParams = "&" + newParams;
                }

                reqOpts.query = reqOpts.query + newParams;
            } else {
                throw new Error("Hallo");
            }
        }

        function _constructPayload(msg, contentFormat) {
            let payload = null;

            if (contentFormat === "text/plain") {
                payload = msg.payload.toString();
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
            reqOpts.method = config.method.toUpperCase() ?? "GET";

            if (config.method === "use" && msg.method != null) {
                reqOpts.method = msg.method.toUpperCase();
            }

            if (reqOpts.method === "IPATCH") {
                reqOpts.method = "iPATCH";
            }

            reqOpts.headers = msg.headers ?? {};
            reqOpts.multicast = config.multicast;
            reqOpts.multicastTimeout = config.multicastTimeout;
            reqOpts.confirmable = msg.confirmable ?? config.confirmable ?? true;

            function _onResponse(res) {
                function _send(payload) {
                    if (!reqOpts.observe) {
                        node.status({});
                    }
                    node.send(
                        Object.assign({}, msg, {
                            payload: payload,
                            headers: res.headers,
                            statusCode: res.code,
                        })
                    );
                }

                function _onResponseData(data) {
                    var contentFormat = res.headers["Content-Format"];
                    var configContentFormat = config["content-format"];

                    if (config["raw-buffer"] === true || configContentFormat === "raw-buffer") {
                        _send(data);
                    } else if (contentFormat === "text/plain" || configContentFormat === "text/plain") {
                        _send(data.toString());
                    } else if (contentFormat.startsWith("application/") && contentFormat.includes("json")) {
                        try {
                            _send(JSON.parse(data.toString()));
                        } catch (error) {
                            node.status({
                                fill: "red",
                                shape: "ring",
                                text: error.message,
                            });
                            node.error(error.message);
                        }
                    } else if (contentFormat.startsWith("application/") && contentFormat.includes("cbor")) {
                        cbor.decodeAll(data, function (error, data) {
                            if (error) {
                                node.error(error.message);
                                node.status({
                                    fill: "red",
                                    shape: "ring",
                                    text: error.message,
                                });
                                return false;
                            }
                            _send(data[0]);
                        });
                    } else if (contentFormat === "application/link-format") {
                        _send(linkFormat.parse(data.toString()));
                    } else {
                        _send(data.toString());
                    }
                }

                res.on("data", _onResponseData);

                if (reqOpts.observe === true) {
                    node.status({
                        fill: "blue",
                        shape: "dot",
                        text: "coapRequest.status.observing",
                    });
                    node.stream = res;
                }
            }

            var payload;

            if (reqOpts.method !== "GET") {
                reqOpts.headers["Content-Format"] ??= config["content-format"]; // jshint ignore:line
                payload = _constructPayload(msg, reqOpts.headers["Content-Format"]);
            } else if (paytoqs === "query") {
                try {
                    _appendQueryParams(reqOpts, msg.payload);
                } catch (error) {
                    node.error("Coap request: Invalid payload format!");
                    return;
                }
            }

            if (config.observe === true) {
                reqOpts.observe = true;
            } else {
                delete reqOpts.observe;
            }

            // TODO: should revisit this block
            if (node.stream) {
                node.stream.close();
            }

            var req = coap.request(reqOpts);
            req.on("response", _onResponse);
            req.on("error", function (error) {
                node.status({
                    fill: "red",
                    shape: "ring",
                    text: error.message,
                });
                node.log("client error");
                node.log(error.message);
            });

            if (payload != null) {
                req.write(payload);
            }
            req.end();
        }

        this.on("input", function (msg) {
            node.status({
                fill: "blue",
                shape: "dot",
                text: "coapRequest.status.requesting",
            });
            _makeRequest(msg);
        });

        this.on("close", function () {
            node.status({});
        });
    }
    RED.nodes.registerType("coap request", CoapRequestNode);
};
