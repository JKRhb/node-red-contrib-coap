module.exports = function(RED) {
    "use strict";
    
    var coap = require('coap');
    var url = require('url');
  
    function CoapRequestNode(n) {
        RED.nodes.createNode(this, n);
        var node = this;

        this.options = url.parse(n.url);
        this.options.method = (n.method || 'GET').toUpperCase();

        this.on('input', function(msg) {
            if (msg.observe === true) {
                node.options.observe = '1';
            } else {
                delete node.options.observe;
            }

            if (node.stream) {
                node.stream.close();
            }

            var req = coap.request(node.options);
            req.on('response', function(res) {
                res.on('data', function(data) {
                    var msg = {
                        payload: JSON.parse(data.toString())
                    };
                    node.send(msg);
                    node.status({});
                });

                if (node.options.observe) {
                    node.stream = res;
                }
            });
            req.end();
        });
    }
    RED.nodes.registerType("coap request", CoapRequestNode);
}