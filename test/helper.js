var should = require("should");
var when = require("when");
var RED = require("../node_modules/node-red/red/red.js");
var redNodes = require("../node_modules/node-red/red/nodes");
var flows = require("../node_modules/node-red/red/nodes/flows");
var credentials = require("../node_modules/node-red/red/nodes/credentials");
var comms = require("../node_modules/node-red/red/comms.js");

var http = require('http');
var express = require('express');
var app = express();

var address = '127.0.0.1';
var listenPort = 0; // use ephemeral port
var port;
var url;

var server;

// Node-RED writes to the console using `util.log`
// Replacing this function by a no-op makes tests output much more readable.
try {
	var util = require('util');
	util.log = function(){};
} catch (e) {}

function helperNode(n) {
    RED.nodes.createNode(this, n);
}

module.exports = {
    load: function(testNodes, testFlows, testCredentials, cb) {
        if (typeof testCredentials !== 'object') {
            cb = testCredentials;
            testCredentials = {};
        }

        var storage = {
            getFlows: function() {
                var defer = when.defer();
                defer.resolve(testFlows);
                return defer.promise;
            },
            getCredentials: function() {
                var defer = when.defer();
                defer.resolve(testCredentials);
                return defer.promise;
            },
            saveCredentials: function() {
                // do nothing
            },
        };
        var settings = {
            available: function() { return false; }
        };

        redNodes.init(settings, storage);
        credentials.init(storage);
        RED.nodes.registerType("helper", helperNode);

        //testNode(RED);

        for (var i = 0; i < testNodes.length; i++) {
            testNodes[i](RED);
        }
        flows.load().then(function() {
            should.deepEqual(testFlows, flows.getFlows());
            if ( cb instanceof Function ) {
                cb();
            }
        });
    },
    unload: function() {
        // TODO: any other state to remove between tests?
        redNodes.clearRegistry();
        return flows.stopFlows();
    },

    getNode: function(id) {
        return flows.get(id);
    },

    credentials: credentials,

    clearFlows: function() {
        return flows.clear();
    },

    startServer: function(done) {
        server = http.createServer(function(req,res){app(req,res);});
        RED.init(server, {});
        server.listen(listenPort, address);
        server.on('listening', function() {
            port = server.address().port;
            url = 'http://' + address + ':' + port;
            comms.start();
            done();
        });
    },
    //TODO consider saving TCP handshake/server reinit on start/stop/start sequences
    stopServer: function(done) {
        if(server) {
            server.close(done);
        }
    },

    url: function() { return url; },

    endTest: function (done, fn) {
        var r;
        try {
            fn();
        } catch (e) { r = e; }
        done(r);
    }
};
