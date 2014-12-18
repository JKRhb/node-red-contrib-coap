var should = require("should");

var coap = require("coap");
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
                        name:"coapIn",
                        url:"/test",
                        server:"coapServer1"
                    }
                   ];

        //need to register nodes in order to use them
        var testNodes = [coapInNode];
        helper.load(testNodes, flow, function() {
            var coapIn1 = helper.getNode("coapIn1");
            coapIn1.options.should.have.property('name', 'coapIn');
            coapIn1.options.should.have.property('url', '/test');
            coapIn1.options.should.have.property('server');
            done();
        });
    });

    it('should accept GET requests', function(done) {
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
                        name:"coapIn",
                        url:"/test",
                        server:"coapServer1",
                        wires:[["coapOut1"]]
                    },
                    {
                        id:'coapOut1',
                        type:"function",
                        name:"coapOut",
                        func:"msg.res.end('whatup');\nreturn msg;",
                        wires:[]
                    }
                   ];
        //need to register nodes in order to use them
        var testNodes = [functionNode, coapInNode];
        helper.load(testNodes, flow, function() {
            var req   = coap.request('coap://localhost:8888/test');

            req.on('response', function(res) {
                res.pipe(process.stdout);
                done();
            });

            req.end();
        });
    });
});
