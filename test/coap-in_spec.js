var should = require("should");

var coap = require("coap");
var url = require("url");
var coapInNode = require("../coap/coap-in.js");
var functionNode = require("../node_modules/node-red/nodes/core/core/80-function.js");
var helper = require("./helper.js");

describe('CoapInNode', function() {
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
                        id:"coapServer1",
                        type:"coap-server",
                        name:"coapServer",
                        port:5683
                    },
                    {
                        id:"coapIn1",
                        type:"coap in",
                        method:"GET",
                        name:"coapIn",
                        url:"/test",
                        server:"coapServer1"
                    }
                   ];

        //need to register nodes in order to use them
        var testNodes = [coapInNode];
        helper.load(testNodes, flow, function() {
            var coapIn1 = helper.getNode("coapIn1");
            coapIn1.options.should.have.property('method', 'GET');
            coapIn1.options.should.have.property('name', 'coapIn');
            coapIn1.options.should.have.property('url', '/test');
            coapIn1.options.should.have.property('server');
            done();
        });
    });

    it('should accept GET, PUT, POST & DELETE requests', function(done) {
        var messageGet = 'You get me, buddy';
        var messagePut = 'This resource sucks- need to change it';
        var messagePost = 'Welcome aboard!';
        var messageDelete = 'Erase and rewind...';
        var flow = [
                    {
                        id:"coapServer1",
                        type:"coap-server",
                        name:"coapServer",
                        port:8888
                    },
                    {
                        id:"coapIn1",
                        type:"coap in",
                        method:"GET",
                        name:"coapInGet",
                        url:"/test",
                        server:"coapServer1",
                        wires:[["coapOut1"]]
                    },
                    {
                        id:"coapIn2",
                        type:"coap in",
                        method:"PUT",
                        name:"coapInPut",
                        url:"/test",
                        server:"coapServer1",
                        wires:[["coapOut2"]]
                    },
                    {
                        id:"coapIn3",
                        type:"coap in",
                        method:"POST",
                        name:"coapInPost",
                        url:"/test",
                        server:"coapServer1",
                        wires:[["coapOut3"]]
                    },
                    {
                        id:"coapIn4",
                        type:"coap in",
                        method:"DELETE",
                        name:"coapInDelete",
                        url:"/test",
                        server:"coapServer1",
                        wires:[["coapOut4"]]
                    },
                    {
                        id:'coapOut1',
                        type:"function",
                        name:"coapOutGet",
                        func:"msg.res.end('"+ messageGet +"');\nreturn msg;",
                        wires:[]
                    },
                    {
                        id:'coapOut2',
                        type:"function",
                        name:"coapOutPut",
                        func:"msg.res.end('"+ messagePut +"');\nreturn msg;",
                        wires:[]
                    },
                    {
                        id:'coapOut3',
                        type:"function",
                        name:"coapOutPost",
                        func:"msg.res.end('"+ messagePost +"');\nreturn msg;",
                        wires:[]
                    },
                    {
                        id:'coapOut4',
                        type:"function",
                        name:"coapOutDelete",
                        func:"msg.res.end('"+ messageDelete +"');\nreturn msg;",
                        wires:[]
                    },
                   ];

        //need to register nodes in order to use them
        var testNodes = [functionNode, coapInNode];
        helper.load(testNodes, flow, function() {

            // Encapsulating callbacks to avoid too much nesting
            function testRequest1StartChain() {
                var req   = coap.request('coap://localhost:8888/test');

                req.on('response', function(res) {
                    res.payload.toString().should.equal(messageGet);
                    testRequest2();
                });
                req.end();
            }
            function testRequest2() {
                var urlStr = "coap://localhost:8888/test";
                var opts = url.parse(urlStr);
                opts.method = "PUT";
                var req = coap.request(opts);

                req.on('response', function(res) {
                    res.payload.toString().should.equal(messagePut);
                    testRequest3();
                });
                req.end();
            }
            function testRequest3() {
                var urlStr = "coap://localhost:8888/test";
                var opts = url.parse(urlStr);
                opts.method = "POST";
                var req = coap.request(opts);

                req.on('response', function(res) {
                    res.payload.toString().should.equal(messagePost);
                    testRequest4EndChain();
                });
                req.end();
            }
            function testRequest4EndChain() {
                var urlStr = "coap://localhost:8888/test";
                var opts = url.parse(urlStr);
                opts.method = "DELETE";
                var req = coap.request(opts);

                req.on('response', function(res) {
                    res.payload.toString().should.equal(messageDelete);
                    done();
                });
                req.end();
            }

            testRequest1StartChain();
        });
    });
});
