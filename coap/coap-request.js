module.exports = function(RED) {
    "use strict";

    var coap = require('coap');
    var cbor = require('cbor');
    var url = require('url');
    var linkFormat = require('h5.linkformat');

    coap.registerFormat('application/cbor', 60);

	var states={
		none:0,
		requested:1,
		responded:2,
	};
    function CoapRequestNode(n) {
        RED.nodes.createNode(this, n);
        var node = this;
		
		var connectstate=states.none;

        // copy "coap request" configuration locally
        node.options = {};
        node.options.method = n.method||"GET";
        node.options.observe = n.observe||false;
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

        // this is for testing purposes- payloadDecodedHandler should be set by test code to inspect the payload
        node.payloadDecodedHandler = function(payload) {};

        function onPayloadDecoded(payload) { 
            node.payloadDecodedHandler(payload);
        }

        function _onCborDecode(err, data) {
            if (err) {
                return false;
            }
            var payload = data[0];
            node.send({
                payload: payload,
            });
            onPayloadDecoded(payload);
        }

        function _makeRequest(msg) {
			var reqOpts = url.parse(node.options.url || msg.url);
            reqOpts.method = ( node.options.method || msg.method || 'GET' ).toUpperCase();
            reqOpts.headers = {};
            reqOpts.headers['Content-Format'] = node.options.contentFormat;
			reqOpts.timeout=10;
            function _onResponse(res) {
				
                function _onResponseData(data) {
					node.status({fill:"green",shape:"dot",text:"Connected "+(reqOpts.observe ? "(observed)":"")+new Date()});
                    var payload = null;
                    if ( node.options.rawBuffer ) {
                        node.send({
                            payload: data,
							state: 1
                        });
                        onPayloadDecoded(data);
                    } else if (res.headers['Content-Format'] === 'text/plain') {
                        payload = data.toString();
                        node.send({
                            payload: payload,
							state: 1
                        });
                        onPayloadDecoded(payload);
                    } else if (res.headers['Content-Format'] === 'application/json') {
                        payload = JSON.parse(data.toString());
                        node.send({
                            payload: payload,
							state: 1
                        });
                        onPayloadDecoded(payload);
                    } else if (res.headers['Content-Format'] === 'application/cbor') {
                        cbor.decodeAll(data, _onCborDecode);
                    } else if (res.headers['Content-Format'] === 'application/link-format') {
                        payload = linkFormat.parse( data.toString() );
                        node.send({
                            payload: payload,
							state: 1
                        });
                        onPayloadDecoded(payload);
                    } else {
                        node.send({
                            payload: data.toString(),
							state: 1
                        });
                        onPayloadDecoded(data.toString());
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

			node.status({fill:"yellow",shape:"ring",text:"Pending ("+(reqOpts.observe ? "Observed ":"")+reqOpts.method+" request)"});
			
			
            var req = coap.request(reqOpts);
			
            req.on('response', _onResponse);
            req.on('error', function(err) {
                node.log('client error');
                node.log(err);
				node.status({fill:"red",shape:"ring",text:"Error:"+err});
				node.send({
					state: 0
				});
            });
			req.on('timeout', function() {
				node.status({fill:"red",shape:"ring",text:"Timeout"});
				node.send({
					state: 0
				});
            });

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
