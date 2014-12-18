module.exports = function(RED) {
    "use strict";
    
    var coap = require('coap');
    var cbor = require('cbor');
    var url = require('url');
    
    coap.registerFormat('application/cbor', 60);
  
    function CoapRequestNode(n) {
        RED.nodes.createNode(this, n);
        var node = this;
        var method = (n.method || 'GET').toUpperCase();

        this.on('input', function(msg) {

            var opts = url.parse(n.url);
        
            opts.method = method;
            opts.headers = {};
        
            if (n['content-format']) {
                opts.headers['Content-Format'] = n['content-format'];
            }
            
            var payload = null;

            if (typeof msg.payload === "string" || Buffer.isBuffer(msg.payload)) {
                payload = msg.payload;
            } else if (typeof msg.payload == "number") {
                payload = msg.payload+"";
            } else {
                if (opts.headers['Content-Format'] === 'application/json') {
                    payload = JSON.stringify(msg.payload);
                } else if (opts.headers['Content-Format'] === 'application/cbor') {
                    payload = cbor.encode(msg.payload);
                }
            }

            if (msg.observe === true) {
                opts.observe = '1';
            } else {
                delete opts.observe;
            }

            if (node.stream) {
                node.stream.close();
            }
            
            var req = coap.request(opts);
            
            req.on('response', function(res) {
                res.on('data', function(data) {
                    if (res.headers['Content-Format'] === 'application/json') {
                        node.send({
                            payload: JSON.parse(data.toString())
                        });
                    } else if (res.headers['Content-Format'] === 'application/cbor') {
                        cbor.decode(data, function(err, data) {
                            if (err) {
                                console.error(err.message);
                                return false;
                            }
                            node.send({
                                payload: data[0]
                            });
                        });
                    } else {
                        node.send({
                            payload: data
                        });
                    }
                });

                if (opts.observe) {
                    node.stream = res;
                }
            });
            if (payload) {
                req.write(payload);
            }
            req.end();
        });
    }
    RED.nodes.registerType("coap request", CoapRequestNode);
};