module.exports = function(RED) {
    "use strict";
    
    var coap = require('coap');
    var url = require('url');
  
    function CoapRequestNode(n) {
        RED.nodes.createNode(this, n);
        var node = this;

        this.options = url.parse(n.url);
        this.options.method = n.method || 'get';
        this.options.observe = n.observe === '1';
        
        this.on('input', function(msg) {
            // var payload = JSON.parse(msg.payload);
            var payload = msg.payload;

            var req = coap.request(this.options);
            req.on('response', function(res) {
                res.on('data', function(data) {
                    var msg = {
                        payload: JSON.parse(data.toString())
                    };
                    node.send(msg);
                    node.status({});
                });
            });
            req.end();
        });
    }
    RED.nodes.registerType("coap request", CoapRequestNode);
}