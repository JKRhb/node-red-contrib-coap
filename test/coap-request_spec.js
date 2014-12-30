var cbor = require("cbor");
var coap = require("coap");
var url = require("url");

var coapRequestNode = require("../coap/coap-request.js");
var injectNode = require("../node_modules/node-red/nodes/core/core/20-inject.js");

var should = require("should");
var helper = require("./helper.js");


// TODO:
// - should we move the test CoAP server creation to helper.js?

describe('CoapRequestNode', function() {
    beforeEach(function(done) {
        helper.startServer(done);
    });

    afterEach(function(done) {
        helper.unload().then(function() {
            helper.stopServer(done);
        });
    });

    it('should be loaded', function(done) {
        var flow = [
                    {
                        id: "coapRequest1",
                        type: "coap request",
                        "content-format": "application/json",
                        method: "POST",
                        name: "coapRequestPost",
                        observe: false,
                        url: "/test-resource",
                    },
                   ];

        helper.load([coapRequestNode], flow, function() {
            var coapRequest1 = helper.getNode("coapRequest1");
            coapRequest1.options.should.have.property('method', 'POST');
            coapRequest1.options.should.have.property('name', 'coapRequestPost');
            coapRequest1.options.should.have.property('observe', false);
            coapRequest1.options.should.have.property('url', '/test-resource');
            done();
        });
    });

    it('should be able to make GET, PUT, POST & DELETE requests', function(done) {
        // create flow: inject (fire immediately), coap request,

        // The flow:
        // - 4 periodical "inject" nodes with periods of 1, 2, 3 & 4 seconds respectively
        // - 4 "coap request" nodes which get triggered by their respective "inject" nodes
        var flow = [
                    {
                        id: "inject1",
                        type: "inject",
                        name: "Every 1s (inject)",
                        payload: "",
                        payloadType: "none",
                        repeat: "1",
                        crontab: "",
                        once: false,
                        wires: [["coapRequest1"]],
                    },
                    {
                        id: "coapRequest1",
                        type: "coap request",
                        "content-format": "text/plain",
                        method: "GET",
                        name: "coapRequestGet",
                        observe: false,
                        url: "coap://localhost:8888/test-resource",
                    },
                    {
                        id: "inject2",
                        type: "inject",
                        name: "Every 2s (inject)",
                        payload: "",
                        payloadType: "none",
                        repeat: "2",
                        crontab: "",
                        once: false,
                        wires: [["coapRequest2"]],
                    },
                    {
                        id: "coapRequest2",
                        type: "coap request",
                        "content-format": "text/plain",
                        method: "PUT",
                        name: "coapRequestPut",
                        observe: false,
                        url: "coap://localhost:8888/test-resource",
                    },
                    {
                        id: "inject3",
                        type: "inject",
                        name: "Every 3s (inject)",
                        payload: "",
                        payloadType: "none",
                        repeat: "3",
                        crontab: "",
                        once: false,
                        wires: [["coapRequest3"]],
                    },
                    {
                        id: "coapRequest3",
                        type: "coap request",
                        "content-format": "text/plain",
                        method: "POST",
                        name: "coapRequestPost",
                        observe: false,
                        url: "coap://localhost:8888/test-resource",
                    },
                    {
                        id: "inject4",
                        type: "inject",
                        name: "Every 4s (inject)",
                        payload: "",
                        payloadType: "none",
                        repeat: "4",
                        crontab: "",
                        once: false,
                        wires: [["coapRequest4"]],
                    },
                    {
                        id: "coapRequest4",
                        type: "coap request",
                        "content-format": "text/plain",
                        method: "DELETE",
                        name: "coapRequestDelete",
                        observe: false,
                        url: "coap://localhost:8888/test-resource",
                    },
                   ];



        var testNodes = [coapRequestNode, injectNode];

        var messageGet = 'You get me, buddy';
        var messagePut = 'This resource sucks- need to change it';
        var messagePost = 'Welcome aboard!';
        var messageDelete = 'Erase and rewind...';

        // let's make a CoAP server to respond to our requests (no matter how silly they are)
        var server = coap.createServer();
        server.on('request', function(req, res) {
            res.setOption('Content-Format', 'text/plain');
            if (req.url == "/test-resource" && req.method == "GET") {
                res.end(messageGet);
            }
            else if (req.url == "/test-resource" && req.method == "PUT") {
                res.end(messagePut);
            }
            else if (req.url == "/test-resource" && req.method == "POST") {
                res.end(messagePost);
            }
            else if (req.url == "/test-resource" && req.method == "DELETE") {
                res.end(messageDelete);
            }
        });
        server.listen(8888, function() {
            console.log('Test CoAP Server Started');
        });

        helper.load(testNodes, flow, function() {
            //Let's catch the responses and compare the payloads to the expected results.
            var secondRequestTestingInitiated = false;
            var thirdRequestTestingInitiated = false;
            var fourthRequestTestingInitiated = false;
            function testRequest1StartChain() {
                var coapRequest1 = helper.getNode("coapRequest1");
                coapRequest1.payloadDecodedHandler = function(payload) {
                    payload.toString().should.equal(messageGet);
                    if (!secondRequestTestingInitiated) {
                        testRequest2();
                    }
                };
            }
            function testRequest2() {
                secondRequestTestingInitiated = true;
                var coapRequest2 = helper.getNode("coapRequest2");
                coapRequest2.payloadDecodedHandler = function(payload) {
                    payload.toString().should.equal(messagePut);
                    if (!thirdRequestTestingInitiated) {
                        testRequest3();
                    }
                };
            }
            function testRequest3() {
                thirdRequestTestingInitiated = true;
                var coapRequest3 = helper.getNode("coapRequest3");
                coapRequest3.payloadDecodedHandler = function(payload) {
                    payload.toString().should.equal(messagePost);
                    if (!fourthRequestTestingInitiated) {
                        testRequest4EndChain();
                    }
                };
            }
            function testRequest4EndChain() {
                fourthRequestTestingInitiated = true;
                var coapRequest4 = helper.getNode("coapRequest4");
                coapRequest4.payloadDecodedHandler = function(payload) {
                    payload.toString().should.equal(messageDelete);
                    done();
                };
            }
            testRequest1StartChain();
        });
    });

    it('should get resource updates after making GET request with "Observe" header', function(done) {
        // The flow:
        // - 2 fire-once inject nodes which are connected to 2 "coap request" nodes
        // - 4 "coap request" GET nodes with "Observe" option enabled which get triggered by their respective "inject" nodes
        var flow = [
                    {
                        id: "inject1",
                        type: "inject",
                        name: "Fire once (inject)",
                        payload: "",
                        payloadType: "none",
                        repeat: "",
                        crontab: "",
                        once: true,
                        wires: [["coapRequest1"]],
                    },
                    {
                        id: "coapRequest1",
                        type: "coap request",
                        "content-format": "text/plain",
                        method: "GET",
                        name: "coapRequestGetObserve1",
                        observe: true,
                        url: "coap://localhost:8889/test-resource1",
                    },
                    {
                        id: "inject2",
                        type: "inject",
                        name: "Fire once (inject)",
                        payload: "",
                        payloadType: "none",
                        repeat: "",
                        crontab: "",
                        once: true,
                        wires: [["coapRequest2"]],
                    },
                    {
                        id: "coapRequest2",
                        type: "coap request",
                        "content-format": "text/plain",
                        method: "GET",
                        name: "coapRequestGetObserve2",
                        observe: true,
                        url: "coap://localhost:8889/test-resource2",
                    },
                   ];

        // Response payloads
        var message1 = 'message1';
        var message2 = 'message2';

        // CoAP server with 2 observable resources
        var server = coap.createServer();
        server.on('request', function(req, res) {
            res.setOption('Content-Format', 'text/plain');
            function response1() {
                res.write(message1);                                     
            }
            function response2() {
                res.write(message2);
            }
            if (req.headers.Observe !== 0) {
              return res.end('Response to a regular request\n');
            }

            var responseFn = null;
            if (req.url == "/test-resource1" && req.method == "GET") {
                responseFn = response1;
            }
            else if (req.url == "/test-resource2" && req.method == "GET") {
                responseFn = response2;
            }
            var interval = setInterval(responseFn, 1000);
                                                                                             
            res.on('finish', function(err) {                                                 
              clearInterval(interval);
            });                                                                               
        });
                                                                                   
                                                                                   
        server.listen(8889, function() {
            console.log('Test CoAP Server Started');
        });

        var testNodes = [coapRequestNode, injectNode];

        helper.load(testNodes, flow, function() {
            var noUpdates1 = 0;
            var noUpdates2 = 0;
            var coapRequest1 = helper.getNode("coapRequest1");
            coapRequest1.payloadDecodedHandler = function(payload) {
                payload.toString().should.equal(message1);
                noUpdates1++;
            };
            var coapRequest2 = helper.getNode("coapRequest2");
            coapRequest2.payloadDecodedHandler = function(payload) {
                payload.toString().should.equal(message2);
                noUpdates2++;
            };

            // Check for the number of updates every second- if we reach the target then the test is complete
            var checkNoUpdatesInterval = setInterval(function() {
                if (noUpdates1 == 3 && noUpdates2 == 3) {
                    clearInterval(checkNoUpdatesInterval);
                    done();
                }
            
            }, 1000);
        });
    
    });

    it('should be able to serialize request payload in a number of formats', function(done) {

        // The flow:
        // - 3 "inject" nodes which trigger "coap request" nodes
        // - 3 "coap request" nodes which send content serialized in text/plain, application/json and application/cbor formats respectively.
        var message1 = 'message1';
        var message2 = 'message2';
        var message3 = 'message3';
        var flow = [
                    {
                        id: "inject1",
                        type: "inject",
                        name: "Fire once (inject)",
                        payload: message1,
                        payloadType: "string",
                        repeat: "",
                        crontab: "",
                        once: true,
                        wires: [["coapRequest1"]],
                    },
                    {
                        id: "coapRequest1",
                        type: "coap request",
                        "content-format": "text/plain",
                        method: "POST",
                        name: "coapRequestPost1",
                        observe: false,
                        url: "coap://localhost:8890/test-resource",
                    },
                    {
                        id: "inject2",
                        type: "inject",
                        name: "Fire once (inject)",
                        payload: message2,
                        payloadType: "string",
                        repeat: "",
                        crontab: "",
                        once: true,
                        wires: [["coapRequest2"]],
                    },
                    {
                        id: "coapRequest2",
                        type: "coap request",
                        "content-format": "application/json",
                        method: "POST",
                        name: "coapRequestPost2",
                        observe: false,
                        url: "coap://localhost:8890/test-resource",
                    },
                    {
                        id: "inject3",
                        type: "inject",
                        name: "Fire once (inject)",
                        payload: message3,
                        payloadType: "string",
                        repeat: "",
                        crontab: "",
                        once: true,
                        wires: [["coapRequest3"]],
                    },
                    {
                        id: "coapRequest3",
                        type: "coap request",
                        "content-format": "application/cbor",
                        method: "POST",
                        name: "coapRequestPost3",
                        observe: false,
                        url: "coap://localhost:8890/test-resource",
                    },
                   ];

        var server = coap.createServer();
        server.on('request', function(req, res) {
            if (req.url !== "/test-resource") {
                res.code = '4.04';
                return res.end();
            } 
            
            if (req.method !== "POST") {
                res.code = '4.05';
                return res.end();
            }

            function respond(res, payload, encode) {
                res.end(encode('Got: ' + payload));
            }

            var encode = null;
            var payload = null;

            if (req.headers['Content-Format'] === 'text/plain') {
                res.setOption('Content-Format', 'text/plain');
                encode = function(payload) { return payload; };
                payload = req.payload;
                respond(res, payload, encode);

            } else if (req.headers['Content-Format'] === 'application/json') {
                res.setOption('Content-Format', 'application/json');
                encode = JSON.stringify;
                payload = JSON.parse(req.payload);
                respond(res, payload, encode);
                
            } else if(req.headers['Content-Format'] === 'application/cbor') {
                res.setOption('Content-Format', 'application/cbor');
                encode = cbor.encode;
                cbor.decode(req.payload, function(err, payload) {
                    respond(res, payload[0], encode);
                });
            }
        });
        server.listen(8890, function() {
            console.log('Test CoAP Server Started');
        });

        var testNodes = [coapRequestNode, injectNode];
        helper.load(testNodes, flow, function() {
            var correctResponses1 = 0;
            var correctResponses2 = 0;
            var correctResponses3 = 0;

            var coapRequest1 = helper.getNode("coapRequest1");
            coapRequest1.payloadDecodedHandler = function(payload) {
                payload.toString().should.equal('Got: ' + message1);
                correctResponses1++;
            };
            var coapRequest2 = helper.getNode("coapRequest2");
            coapRequest2.payloadDecodedHandler = function(payload) {
                payload.toString().should.equal('Got: ' + message2);
                correctResponses2++;
            };
            var coapRequest3 = helper.getNode("coapRequest3");
            coapRequest3.payloadDecodedHandler = function(payload) {
                payload.toString().should.equal('Got: ' + message3);
                correctResponses3++;
            };

            var checkInterval = setInterval(function() {
                if (correctResponses1 == 1 && 
                    correctResponses2 == 1 && 
                    correctResponses3 == 1
                   ) {
                    clearInterval(checkInterval);
                    done(); 
                }
            }, 1000);
        });
    });
});
