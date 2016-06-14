module.exports = function(RED) {
    "use strict";

    var coap = require('coap');
    var cbor = require('cbor');
    var url = require('url');
    var linkFormat = require('h5.linkformat');

    coap.registerFormat('application/cbor', 60);

    function CoapRequestNode(n) {
        RED.nodes.createNode(this, n);
        var node = this;

        // copy "coap request" configuration locally
        node.options = {};
        node.options.method = n.method;
        node.options.observe = n.observe;
        node.options.name = n.name;
        node.options.url = n.url;
        node.options.contentFormat = n['content-format'];
        node.options.rawBuffer = n['raw-buffer'];

        function _constructPayload(msg, contentFormat) {
            var payload = null;

            if (contentFormat === 'text/plain') {
                payload = msg.payload;
            } else if (contentFormat === 'application/json') {
                payload = JSON.stringify(msg.payload);
            } else if (contentFormat === 'application/cbor') {
                payload = cbor.encode(msg.payload);
            }

            return payload;
        }

        function _onCborDecode(err, data) {
            if (err) {
                return false;
            }
            var payload = data[0];
            node.send({
                payload: payload,
            });
        }

        function _makeRequest(msg) {
            var reqOpts = url.parse(node.options.url || msg.url);
            reqOpts.method = ( node.options.method || msg.method || 'GET' ).toUpperCase();
            reqOpts.headers = {};
            reqOpts.headers['Content-Format'] = node.options.contentFormat;

            function _onResponse(res) {
                function _onResponseData(data) {
                    var payload = null;
                    if ( node.options.rawBuffer ) {
                        node.send({
                            payload: data,
                        });
                    } else if (res.headers['Content-Format'] === 'text/plain') {
                        payload = data.toString();
                        node.send({
                            payload: payload,
                        });
                    } else if (res.headers['Content-Format'] === 'application/json') {
                        payload = JSON.parse(data.toString());
                        node.send({
                            payload: payload,
                        });
                    } else if (res.headers['Content-Format'] === 'application/cbor') {
                        cbor.decodeAll(data, _onCborDecode);
                    } else if (res.headers['Content-Format'] === 'application/link-format') {
                        payload = linkFormat.parse( data.toString() );
                        node.send({
                            payload: payload,
                        });
                    } else {
                        node.send({
                            payload: data.toString(),
                        });
                    }
                }

                res.on('data', _onResponseData);

                if (reqOpts.observe) {
                    node.stream = res;
                }
            }

            var payload = _constructPayload(msg, node.options.contentFormat);

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
            req.on('error', function(err) {
                node.log('client error');
                node.log(err);
            });

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
