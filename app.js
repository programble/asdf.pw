var fs      = require('fs');
var http    = require('http');
var url     = require('url');
var shortId = require('shortid');
var Redis   = require('redis');
var redis   = Redis.createClient();
var readme  = fs.readFileSync(__dirname + '/README', 'utf8');
http.createServer(function(req, res) {
  res.endHead = function(status) {
    res.writeHead(status);
    res.end();
  };
  res.error = function(err) {
    console.error(err.stack);
    res.endHead(500);
  };
  req.getLong = function(done) {
    req.setEncoding('utf8');
    req.on('data', function(long) {
      if (long.length > 1024) return res.endHead(413);
      var longURL = url.parse(long);
      if (!(longURL.protocol == 'http:' || longURL.protocol == 'https:'))
        return res.endHead(400);
      done(longURL.href);
    });
  };
  res.sendShort = function(short) {
    res.writeHead(200);
    res.write('http://' + req.headers.host + '/' + short);
    res.end();
  };
  res.setHeader('Content-Type', 'text/plain');
  var short = req.url.slice(1);
  if (req.method == 'GET') {
    if (!short) {
      res.writeHead(200);
      res.write(readme);
      return res.end();
    }
    redis.get('short:'+short, function(err, long) {
      if (err) return res.error(err);
      if (!long) return res.endHead(404);
      res.writeHead(302, { Location: long });
      res.write(long);
      res.end();
    });
  } else if (req.method == 'POST') {
    req.getLong(function(long) {
      redis.get('long:' + long, function(err, short) {
        if (err) return res.error(err);
        if (short) return res.sendShort(short);
        short = shortId.generate();
        redis.mset('short:'+short, long, 'long:'+long, short, function(err) {
          if (err) return res.error(err);
          res.sendShort(short);
        });
      });
    });
  } else if (req.method == 'PUT') {
    if (!short) return res.endHead(400);
    redis.get('short:'+short, function(err, long) {
      if (err) return res.error(err);
      if (long) return res.endHead(409);
      req.getLong(function(long) {
        redis.set('short:'+short, long, function(err) {
          if (err) return res.error(err);
          res.sendShort(short);
        });
      });
    });
  } else res.endHead(405);
}).listen(process.env.PORT || 8080);
