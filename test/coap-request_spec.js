var cbor = require("cbor");
var coap = require("coap");
var url = require("url");

var coapRequestNode = require("../coap/coap-request.js");
var injectNode = require("node-red/nodes/core/core/20-inject.js");
var changeNode = require("node-red/nodes/core/logic/15-change.js");

var should = require("should");
var helper = require("./helper.js");
var linkFormat = require('h5.linkformat');

// TODO:
// - should we move the test CoAP server creation to helper.js?

describe('CoapRequestNode', function() {
    this.slow(300);
    var i;

    var lastPort = 8887;
    function getPort() {
        return ++lastPort;
    }

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

    describe('Methods', function() {

        var methodTests = [
            { method: 'GET',    message: 'You get me, buddy' },
            { method: 'PUT',    message: 'This resource sucks–need to change it' },
            { method: 'POST',   message: 'Welcome aboard!' },
            { method: 'DELETE', message: 'Erase and rewind…' }
        ];

        for (i = 0; i < methodTests.length; ++i) {
            (function(test) {
                it('should be able to make ' + test.method + ' requests', function(done) {
                    var port = getPort();
                    var flow = [
                                {
                                    id: "n1",
                                    type: "inject",
                                    name: "inject",
                                    payload: "",
                                    payloadType: "none",
                                    repeat: "",
                                    crontab: "",
                                    once: true,
                                    wires: [["n2"]],
                                },
                                {
                                    id: "n2",
                                    type: "coap request",
                                    "content-format": "text/plain",
                                    method: test.method,
                                    name: "coapRequest",
                                    observe: false,
                                    url: "coap://localhost:" + port + "/test-resource",
                                    wires: [["n3"]],
                                },
                                {
                                    id: "n3",
                                    type: "end-test-node",
                                    name: "end-test-node",
                                },
                               ];

                    var endTestNode = helper.endTestNode(done, function(msg) {
                        msg.payload.toString().should.equal(test.message);
                    });
                    var testNodes = [coapRequestNode, injectNode, endTestNode];

                    // let's make a CoAP server to respond to our requests (no matter how silly they are)
                    var server = coap.createServer();
                    server.on('request', function(req, res) {
                        res.setOption('Content-Format', 'text/plain');
                        req.url.should.equal("/test-resource");
                        req.method.should.equal(test.method);
                        res.end(test.message);
                    });
                    server.listen(port);

                    helper.load(testNodes, flow);
                });
            }) (methodTests[i]);
        }

        it('should use msg.method', function(done) {
            var port = getPort();
            var flow = [
                        {
                            id: "n1",
                            type: "inject",
                            name: "inject",
                            payload: "",
                            payloadType: "none",
                            repeat: "",
                            crontab: "",
                            once: true,
                            wires: [["n2"]],
                        },
                        {
                            id: "n2",
                            type: "change",
                            action: "replace",
                            property: "method",
                            from: "",
                            to: "PUT",
                            reg: false,
                            name: "set method",
                            wires: [["n3"]],
                        },
                        {
                            id: "n3",
                            type: "coap request",
                            "content-format": "text/plain",
                            method: "",
                            name: "coapRequest",
                            observe: false,
                            url: "coap://localhost:" + port + "/test-resource",
                        },
                       ];

            var testNodes = [coapRequestNode, injectNode, changeNode];

            var server = coap.createServer();
            server.on('request', function(req, res) {
                helper.endTest(done,function(){
                    req.method.should.equal("PUT");
                });
            });
            server.listen(port);
            helper.load(testNodes, flow);
        });

        it('should preserve message properties', function(done) {
            var port = getPort();
            var flow = [
                        {
                            id: "n1",
                            type: "inject",
                            name: "inject",
                            payload: "",
                            payloadType: "none",
                            repeat: "",
                            crontab: "",
                            once: true,
                            wires: [["n2"]],
                        },
                        {
                            id: "n2",
                            type: "change",
                            action: "replace",
                            property: "random_property",
                            from: "",
                            to: "I will survive",
                            reg: false,
                            name: "set random_property",
                            wires: [["n3"]],
                        },
                        {
                            id: "n3",
                            type: "coap request",
                            "content-format": "text/plain",
                            method: "",
                            name: "coapRequest",
                            observe: false,
                            url: "coap://localhost:" + port + "/test-resource",
                            wires: [["n4"]],
                        },
                        {
                            id: "n4",
                            type: "end-test-node",
                            name: "read random_property",
                        },
                       ];

            var endTestNode = helper.endTestNode(done, function(msg) {
                msg.should.have.property('random_property', 'I will survive');
            });

            var testNodes = [coapRequestNode, injectNode, changeNode, endTestNode];

            var server = coap.createServer();
            server.on('request', function(req, res) {
                res.end('anything');
            });
            server.listen(port);
            helper.load(testNodes, flow);
        });

        it('should export status', function(done) {
            var port = getPort();
            var flow = [
                        {
                            id: "n1",
                            type: "inject",
                            name: "inject",
                            payload: "",
                            payloadType: "none",
                            repeat: "",
                            crontab: "",
                            once: true,
                            wires: [["n2"]],
                        },
                        {
                            id: "n2",
                            type: "coap request",
                            "content-format": "text/plain",
                            method: "GET",
                            name: "coapRequest",
                            observe: false,
                            url: "coap://localhost:" + port + "/test-resource",
                            wires: [["n3"]],
                        },
                        {
                            id: "n3",
                            type: "end-test-node",
                            name: "end-test-node",
                        },
                       ];

            var endTestNode = helper.endTestNode(done, function(msg) {
                msg.should.have.property('statusCode', '4.01');
            });

            var testNodes = [coapRequestNode, injectNode, changeNode, endTestNode];

            var server = coap.createServer();
            server.on('request', function(req, res) {
                res.code = '4.01';
                res.end('anything');
            });
            server.listen(port);
            helper.load(testNodes, flow);
        });

        it('should export headers', function(done) {
            var port = getPort();
            var flow = [
                        {
                            id: "n1",
                            type: "inject",
                            name: "inject",
                            payload: "",
                            payloadType: "none",
                            repeat: "",
                            crontab: "",
                            once: true,
                            wires: [["n2"]],
                        },
                        {
                            id: "n2",
                            type: "coap request",
                            "content-format": "text/plain",
                            method: "GET",
                            name: "coapRequest",
                            observe: false,
                            url: "coap://localhost:" + port + "/test-resource",
                            wires: [["n3"]],
                        },
                        {
                            id: "n3",
                            type: "end-test-node",
                            name: "end-test-node",
                        },
                       ];

            var etag = "@etag@";

            var endTestNode = helper.endTestNode(done, function(msg) {
                msg.should.have.property('headers')
                    .with.property('ETag', etag);
            });

            var testNodes = [coapRequestNode, injectNode, changeNode, endTestNode];

            var server = coap.createServer();
            server.on('request', function(req, res) {
                res.setOption('ETag', etag);
                res.end('anything');
            });
            server.listen(port);
            helper.load(testNodes, flow);
        });

        it('should default to GET if no method is configured', function(done) {
            var port = getPort();
            var flow = [
                        {
                            id: "n1",
                            type: "inject",
                            name: "inject",
                            payload: "",
                            payloadType: "none",
                            repeat: "",
                            crontab: "",
                            once: true,
                            wires: [["n2"]],
                        },
                        {
                            id: "n2",
                            type: "coap request",
                            "content-format": "text/plain",
                            method: "",
                            name: "coapRequest",
                            observe: false,
                            url: "coap://localhost:" + port + "/test-resource",
                        },
                       ];

            var testNodes = [coapRequestNode, injectNode];

            var server = coap.createServer();
            server.on('request', function(req, res) {
                helper.endTest(done,function(){
                    req.method.should.equal("GET");
                });
            });
            server.listen(port);
            helper.load(testNodes, flow);
        });

    });

    it('should use msg.url', function(done) {
        var port = getPort();
        var flow = [
                    {
                        id: "n1",
                        type: "inject",
                        name: "inject",
                        payload: "",
                        payloadType: "none",
                        repeat: "",
                        crontab: "",
                        once: true,
                        wires: [["n2"]],
                    },
                    {
                        id: "n2",
                        type: "change",
                        action: "replace",
                        property: "url",
                        from: "",
                        to: "coap://localhost:" + port + "/test-resource",
                        reg: false,
                        name: "set URL",
                        wires: [["n3"]],
                    },
                    {
                        id: "n3",
                        type: "coap request",
                        "content-format": "text/plain",
                        method: "GET",
                        name: "coapRequest",
                        observe: false,
                        url: "",
                    },
                   ];

        var testNodes = [coapRequestNode, injectNode, changeNode];

        var server = coap.createServer();
        server.on('request', function(req, res) {
            helper.endTest(done,function(){
                req.url.should.equal("/test-resource");
            });
        });
        server.listen(port);
        helper.load(testNodes, flow);
    });

    it('should get resource updates after making GET request with "Observe" header', function(done) {
        var port = getPort();
        // The flow:
        // - 2 fire-once inject nodes which are connected to 2 "coap request" nodes
        // - 4 "coap request" GET nodes with "Observe" option enabled which get triggered by their respective "inject" nodes
        var flow = [
                    {
                        id: "n1",
                        type: "inject",
                        name: "Fire once (inject)",
                        payload: "",
                        payloadType: "none",
                        repeat: "",
                        crontab: "",
                        once: true,
                        wires: [["n2"]],
                    },
                    {
                        id: "n2",
                        type: "coap request",
                        "content-format": "text/plain",
                        method: "GET",
                        name: "coapRequestGetObserve1",
                        observe: true,
                        url: "coap://localhost:" + port + "/test-resource1",
                        wires: [["n3"]],
                    },
                    {
                        id: "n3",
                        type: "end-test-node1",
                        name: "end-test-node1",
                    },
                    {
                        id: "n4",
                        type: "inject",
                        name: "Fire once (inject)",
                        payload: "",
                        payloadType: "none",
                        repeat: "",
                        crontab: "",
                        once: true,
                        wires: [["n5"]],
                    },
                    {
                        id: "n5",
                        type: "coap request",
                        "content-format": "text/plain",
                        method: "GET",
                        name: "coapRequestGetObserve2",
                        observe: true,
                        url: "coap://localhost:" + port + "/test-resource2",
                        wires: [["n6"]],
                    },
                    {
                        id: "n6",
                        type: "end-test-node2",
                        name: "end-test-node2",
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
            var interval = setInterval(responseFn, 10);

            res.on('finish', function(err) {
              clearInterval(interval);
            });
        });
        server.listen(port);

        function endTest(RED) {
            var noUpdates1 = 0;
            var noUpdates2 = 0;

            function testCompletion() {
                if (noUpdates1 == 3 && noUpdates2 == 3) {
                    done();
                }
            }

            function EndTestNode1(n) {
                RED.nodes.createNode(this, n);
                this.on('input', function(msg) {
                    msg.payload.toString().should.equal(message1);
                    noUpdates1++;
                    testCompletion();
                });
            }
            RED.nodes.registerType("end-test-node1", EndTestNode1);

            function EndTestNode2(n) {
                RED.nodes.createNode(this, n);
                this.on('input', function(msg) {
                    msg.payload.toString().should.equal(message2);
                    noUpdates2++;
                    testCompletion();
                });
            }
            RED.nodes.registerType("end-test-node2", EndTestNode2);
        }

        var testNodes = [coapRequestNode, injectNode, endTest];
        helper.load(testNodes, flow);

    });

    describe('Content formats', function() {
        // Using first experimental identifier, which should not ever map
        // to a recognized content-format.
        coap.registerFormat('test/unknown', 65000);

        var serializeFormatTests = [
            {
                format: 'text/plain',
                message: 'this is a plain text message.',
                decode: function(buf) { return Promise.resolve(buf.toString()); }
            },
            {
                format: 'application/json',
                message: { thisIs: 'JSON' },
                decode: function(buf) { return Promise.resolve(JSON.parse(buf.toString())); }
            },
            {
                format: 'application/cbor',
                message: { thisIs: 'CBOR' },
                decode: function(buf) { return new Promise(function(resolve, reject) {
                    cbor.decodeFirst(buf, function(error, value) {
                        if (error) {
                            reject(error);
                        } else {
                            resolve(value);
                        }
                    });
                }); }
            }
        ];

        for (i = 0; i < serializeFormatTests.length; ++i) {
            (function(test) {
                it('should be able to serialize `' + test.format + '` request payload', function(done) {
                    var port = getPort();

                    var flow = [
                                {
                                    id: "n1",
                                    type: "inject",
                                    name: "Fire once",
                                    payload: test.message,
                                    payloadType: "string",
                                    repeat: "",
                                    crontab: "",
                                    once: true,
                                    wires: [["n2"]],
                                },
                                {
                                    id: "n2",
                                    type: "coap request",
                                    "content-format": test.format,
                                    method: "POST",
                                    name: "coapRequestPost",
                                    observe: false,
                                    url: "coap://localhost:" + port + "/test-resource",
                                }
                               ];

                    var server = coap.createServer();
                    server.on('request', function(req, res) {
                        try {
                            req.url.should.equal("/test-resource");
                            req.method.should.equal("POST");
                            req.headers['Content-Format'].should.equal(test.format);
                            test.decode(req.payload)
                                .then(function(val){ val.should.deepEqual(test.message); })
                                .then(done, done); // looks a bit like black magic, but works because the previous line returns `undefined`
                        } catch (e) { done(e); }
                    });
                    server.listen(port);

                    var testNodes = [coapRequestNode, injectNode];
                    helper.load(testNodes, flow);
                });
            }) (serializeFormatTests[i]);
        }

        var deserializeFormatTests = [
            {
                format: 'text/plain',
                message: 'this is a plain text message.',
                encode: function(s) { return s; }
            },
            {
                format: 'application/json',
                message: { thisIs: 'JSON' },
                encode: JSON.stringify
            },
            {
                format: 'application/cbor',
                message: { thisIs: 'CBOR' },
                encode: cbor.encode
            },
            {
                format: 'application/link-format',
                message: linkFormat.parse('</r1>;if=foo;rt=bar,</r2>;if=foo;rt=baz;obs'),
                encode: function(lf) { return lf.toString(); }
            }
        ];

        for (i = 0; i < deserializeFormatTests.length; ++i) {
            (function(test) {
                it('should be able to deserialize `' + test.format + '` response payload', function(done) {
                    var port = getPort();

                    var flow = [
                                {
                                    id: "n1",
                                    type: "inject",
                                    name: "Fire once",
                                    payload: "",
                                    payloadType: "none",
                                    repeat: "",
                                    crontab: "",
                                    once: true,
                                    wires: [["n2"]],
                                },
                                {
                                    id: "n2",
                                    type: "coap request",
                                    "content-format": test.format,
                                    method: "GET",
                                    name: "coapRequestGet",
                                    observe: false,
                                    url: "coap://localhost:" + port + "/test-resource",
                                    wires: [["n3"]],
                                },
                                {
                                    id: "n3",
                                    type: "end-test-node",
                                    name: "end-test-node",
                                },
                               ];

                    var endTestNode = helper.endTestNode(done, function(msg) {
                        Buffer.isBuffer(msg.payload).should.be.false;
                        msg.payload.should.deepEqual(test.message);
                    });

                    var server = coap.createServer();
                    server.on('request', function(req, res) {
                        req.url.should.equal("/test-resource");
                        req.method.should.equal("GET");
                        res.setOption('Content-Format', test.format);
                        res.end(test.encode(test.message));
                    });
                    server.listen(port);

                    var testNodes = [coapRequestNode, injectNode, endTestNode];
                    helper.load(testNodes, flow);
                });
            }) (deserializeFormatTests[i]);
        }

        it('should return raw buffer if configured to', function(done) {
            var port = getPort();
            var flow = [
                        {
                            id: "n1",
                            type: "inject",
                            name: "inject",
                            payload: "",
                            payloadType: "none",
                            repeat: "",
                            crontab: "",
                            once: true,
                            wires: [["n2"]],
                        },
                        {
                            id: "n2",
                            type: "coap request",
                            "content-format": "text/plain",
                            method: "GET",
                            name: "coapRequest",
                            observe: false,
                            "raw-buffer": true,
                            url: "coap://localhost:" + port + "/test-resource",
                            wires: [["n3"]],
                        },
                        {
                            id: "n3",
                            type: "end-test-node",
                            name: "end-test-node",
                        },
                       ];

            var endTestNode = helper.endTestNode(done, function(msg) {
                Buffer.isBuffer(msg.payload).should.be.true;
                msg.payload.toString().should.equal(message);
            });

            var testNodes = [coapRequestNode, injectNode, endTestNode];
            var message = "Got it!";

            // let's make a CoAP server to respond to our requests (no matter how silly they are)
            var server = coap.createServer();
            server.on('request', function(req, res) {
                req.url.should.equal("/test-resource");
                req.method.should.equal("GET");

                res.setOption('Content-Format', 'text/plain');
                res.end(message);
            });
            server.listen(port);

            helper.load(testNodes, flow);
        });

        it('should default to string for unknown content format', function(done) {
            var port = getPort();
            var flow = [
                        {
                            id: "n1",
                            type: "inject",
                            name: "inject",
                            payload: "",
                            payloadType: "none",
                            repeat: "",
                            crontab: "",
                            once: true,
                            wires: [["n2"]],
                        },
                        {
                            id: "n2",
                            type: "coap request",
                            "content-format": "text/plain",
                            method: "GET",
                            name: "coapRequest",
                            observe: false,
                            "raw-buffer": false,
                            url: "coap://localhost:" + port + "/test-resource",
                            wires: [["n3"]],
                        },
                        {
                            id: "n3",
                            type: "end-test-node",
                            name: "end-test-node",
                        },
                       ];

            var endTestNode = helper.endTestNode(done, function(msg) {
                (typeof msg.payload).should.equal("string");
                msg.payload.should.equal(message);
            });

            var testNodes = [coapRequestNode, injectNode, endTestNode];
            var message = "Got it!";

            // let's make a CoAP server to respond to our requests (no matter how silly they are)
            var server = coap.createServer();
            server.on('request', function(req, res) {
                req.url.should.equal("/test-resource");
                req.method.should.equal("GET");
                res.setOption('Content-Format', 'test/unknown');
                res.end(message);
            });
            server.listen(port);

            helper.load(testNodes, flow);
        });
    });
});
