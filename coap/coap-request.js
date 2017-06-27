module.exports = function(RED) {
    "use strict";

    var coap = require('coap');
    var cbor = require('cbor');
    var url = require('uri-js');
    var linkFormat = require('h5.linkformat');

    coap.registerFormat('application/cbor', 60);

    function CoapRequestNode(n) {
        RED.nodes.createNode(this, n);
        var node = this;

        // copy "coap request" configuration locally
        node.options = {};
        node.options.method = n.method;
        node.options.observe = n.observe;
	    node.options.observe_on_start = n.observe_on_start||false;
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

        function _makeRequest(msg) {
            var reqOpts = url.parse(node.options.url || msg.url);
            reqOpts.pathname = reqOpts.path;
            reqOpts.method = ( node.options.method || msg.method || 'GET' ).toUpperCase();
            reqOpts.headers = {};
            reqOpts.headers['Content-Format'] = node.options.contentFormat;

            function _onResponse(res) {

                function _send(payload) {
                    node.send(Object.assign({}, msg, {
                        payload: payload,
                        headers: res.headers,
                        statusCode: res.code,
                    }));
                }

                function _onResponseData(data) {
					node.status({fill:"green",shape:"dot",text:(reqOpts.observe ? "Observed data ":"Data ")+"received ("+new Date().toLocaleTimeString()+")"});
                    if ( node.options.rawBuffer ) {
                        _send(data);
                    } else if (res.headers['Content-Format'] === 'text/plain') {
                        _send(data.toString());
                    } else if (res.headers['Content-Format'] === 'application/json') {
                        _send(JSON.parse(data.toString()));
                    } else if (res.headers['Content-Format'] === 'application/cbor') {
                        cbor.decodeAll(data, function (err, data) {
                            if (err) {
                                return false;
                            }
                            _send(data[0]);
                        });
                    } else if (res.headers['Content-Format'] === 'application/link-format') {
                        _send(linkFormat.parse(data.toString()));
                    } else {
                        _send(data.toString());
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
				node.status({fill:"red",shape:"ring",text:"Error:"+err});
            });
			req.on('timeout', function() {
				node.status({fill:"red",shape:"ring",text:"Timeout"});
            });
			
			node.status({fill:"yellow",shape:"ring",text:"Pending ("+(reqOpts.observe ? "Observed ":"")+reqOpts.method+" request)"});

            if (payload) {
                req.write(payload);
            }
            req.end();
        }

        this.on('input', function(msg) {
            _makeRequest(msg);
        });
		
		this.on('close', function(done) {
			if (node.stream) {
				node.stream.close();
            }
			done();
        });
		
		node.status({});
		
		if(node.options.observe && node.options.observe_on_start){
			var dummyPayload={payload:""};
			_makeRequest(dummyPayload);
		}
    }
    RED.nodes.registerType("coap request", CoapRequestNode);
};
