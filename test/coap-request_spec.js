var should = require("should");
var coap = require("coap");
var url = require("url");
var helper = require("./helper.js");

var coapRequestNode = require("../coap/coap-request.js");
var functionNode = require("../node_modules/node-red/nodes/core/core/80-function.js");
var injectNode = require("../node_modules/node-red/nodes/core/core/20-inject.js");

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
                        "content-format": "application/octet-stream",
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

    it('should be able to make GET, PUT, POST & DELETE requests', function(done){
        // create flow: inject (fire immediately), coap request,

        // The flow:
        // - 4 periodical "inject" nodes with periods of 1, 2, 3 & 4 seconds respectively
        // - 4 "coap request" nodes which get triggered by their respective "inject" nodes
        var flow = [
                    {
                        id: "inject1",
                        type: "inject",
                        name: "Fire once (inject)",
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
                        "content-format": "application/octet-stream",
                        method: "GET",
                        name: "coapRequestGet",
                        observe: false,
                        url: "coap://localhost:8888/test-resource",
                    },
                    {
                        id: "inject2",
                        type: "inject",
                        name: "Fire once (inject)",
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
                        "content-format": "application/octet-stream",
                        method: "PUT",
                        name: "coapRequestPut",
                        observe: false,
                        url: "coap://localhost:8888/test-resource",
                    },
                    {
                        id: "inject3",
                        type: "inject",
                        name: "Fire once (inject)",
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
                        "content-format": "application/octet-stream",
                        method: "POST",
                        name: "coapRequestPost",
                        observe: false,
                        url: "coap://localhost:8888/test-resource",
                    },
                    {
                        id: "inject4",
                        type: "inject",
                        name: "Fire once (inject)",
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
                        "content-format": "application/octet-stream",
                        method: "DELETE",
                        name: "coapRequestDelete",
                        observe: false,
                        url: "coap://localhost:8888/test-resource",
                    },
                   ];



        var testNodes = [coapRequestNode, functionNode, injectNode];

        var messageGet = 'You get me, buddy';
        var messagePut = 'This resource sucks- need to change it';
        var messagePost = 'Welcome aboard!';
        var messageDelete = 'Erase and rewind...';

        // let's make a CoAP server to respond to our requests (no matter how silly they are)
        var server = coap.createServer();
        server.on('request', function(req, res) {
            if (req.url == "/test-resource" && req.method == "GET") {
                res.end(messageGet);
            }
            if (req.url == "/test-resource" && req.method == "PUT") {
                res.end(messagePut);
            }
            if (req.url == "/test-resource" && req.method == "POST") {
                res.end(messagePost);
            }
            if (req.url == "/test-resource" && req.method == "DELETE") {
                res.end(messageDelete);
            }
        });
        server.listen(8888, function() {
            console.log('Test CoAP Server Started');
        });

        helper.load(testNodes, flow, function() {
            //Let's catch the responses and compare the payloads to the expected results.
            var secondRequestInitiated = false;
            var thirdRequestInitiated = false;
            var fourthRequestInitiated = false;
            function testRequest1StartChain() {
                var coapRequest1 = helper.getNode("coapRequest1");
                coapRequest1.payloadDecodedHandler = function(payload) {
                    payload.toString().should.equal(messageGet);
                    if (!secondRequestInitiated) {
                        testRequest2();
                    }
                };
            }
            function testRequest2() {
                secondRequestInitiated = true;
                var coapRequest2 = helper.getNode("coapRequest2");
                coapRequest2.payloadDecodedHandler = function(payload) {
                    payload.toString().should.equal(messagePut);
                    if (!thirdRequestInitiated) {
                        testRequest3();
                    }
                };
            
            }
            function testRequest3() {
                thirdRequestInitiated = true;
                var coapRequest3 = helper.getNode("coapRequest3");
                coapRequest3.payloadDecodedHandler = function(payload) {
                    payload.toString().should.equal(messagePost);
                    if (!fourthRequestInitiated) {
                        testRequest4EndChain();
                    }
                };
            }
            function testRequest4EndChain() {
                fourthRequestInitiated = true;
                var coapRequest4 = helper.getNode("coapRequest4");
                coapRequest4.payloadDecodedHandler = function(payload) {
                    payload.toString().should.equal(messageDelete);
                    done();
                };
            }
            testRequest1StartChain();
        });
    });
});
