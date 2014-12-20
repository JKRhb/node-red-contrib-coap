module.exports = function(RED) {
    "use strict";
    
    var coap = require('coap');
    var cbor = require('cbor');
    var url = require('url');
    
    coap.registerFormat('application/cbor', 60);
  
    function CoapRequestNode(n) {
        RED.nodes.createNode(this, n);
        var node = this;

        // copy "coap request" configuration locally
        node.options = {};
        node.options.method = (n.method || 'GET').toUpperCase();
        node.options.observe = n.observe;
        node.options.name = n.name;
        node.options.url = n.url;
        node.options.contentFormat = n['content-format'];

        function _constructPayload(msg, contentFormat) {
            var payload = null;

            if (typeof msg.payload === "string" || Buffer.isBuffer(msg.payload)) {
                payload = msg.payload;
            } else if (typeof msg.payload === "number") {
                payload = msg.payload + "";
            } else {
                if (contentFormat === 'application/json') {
                    payload = JSON.stringify(msg.payload);
                } else if (contentFormat === 'application/cbor') {
                    payload = cbor.encode(msg.payload);
                }
            }

            return payload;
        }

        // this is for testing purposes- payloadDecodedHandler should be set by test code to inspect the payload
        node.payloadDecodedHandler = function(payload) {};
        function onPayloadDecoded(payload) { 
            node.payloadDecodedHandler(payload);
        }

        function _onCborDecode(err, data) {
            if (err) {
                //console.error(err.message);
                return false;
            }
            var payload = data[0];
            node.send({
                payload: payload,
            });
            onPayloadDecoded(payload);
        }

        function _makeRequest(msg) {
            var reqOpts = url.parse(node.options.url);
            reqOpts.method = node.options.method;
            reqOpts.headers = {};
            reqOpts.headers['Content-Format'] = node.options.contentFormat;
            function _onResponse(res) {
                function _onResponseData(data) {
                    var payload = null;
                    if (res.headers['Content-Format'] === 'application/json') {
                        payload = JSON.parse(data.toString());
                        node.send({
                            payload: payload,
                        });
                        onPayloadDecoded(payload);
                    } else if (res.headers['Content-Format'] === 'application/cbor') {
                        cbor.decode(data, _onCborDecode);
                    } else {
                        payload = data;
                        node.send({
                            payload: payload,
                        });
                        onPayloadDecoded(payload);
                    }
                }

                res.on('data', _onResponseData);

                if (reqOpts.observe) {
                    node.stream = res;
                }
            }

            var payload = _constructPayload(msg, node.options['content-format']);

            if (node.options.observe === true) {
                reqOpts.observe = '1';
            } else {
                delete reqOpts.observe;
            }

            //TODO: should revisit this block
            if (node.stream) {
                node.stream.close();
            }

            var req = coap.request(reqOpts);
            req.on('response', _onResponse);

            if (payload) {
                req.write(payload);
            }
            req.end();
        }

        this.on('input', function(msg) {
            _makeRequest(msg);
        });
    }
    RED.nodes.registerType("coap request", CoapRequestNode);
};
