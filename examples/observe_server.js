const coap = require("../node_modules/coap"),
  server = coap.createServer();

server.on("request", function (req, res) {
  res.setOption("Content-Format", "text/plain");
  if (req.url !== "/topic1") {
    res.code = "4.04";
    return res.end();
  } else if (req.method !== "GET") {
    res.code = "4.05";
    return res.end();
  }

  if (req.headers["Observe"] !== 0)
    return res.end(
      "Update on topic1. Timestamp: " + new Date().toISOString()
    );

  var interval = setInterval(function () {
    res.write("Update on topic1. Timestamp: " + new Date().toISOString());
  }, 1000);

  res.on("finish", function (err) {
    clearInterval(interval);
  });
});

server.listen(function () {
  console.log("server started");
});
