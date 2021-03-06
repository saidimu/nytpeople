'use strict';

var bunyan = require('bunyan');
var Loggly = require('bunyan-loggly');
var hostname = require('os').hostname();

function get_logger(name) {
  if(!name) {
    throw new Error("Invalid logger name '%s'. Cannot create a logger", name);
  }//if

  // default stdout stream
  var streams = [{
    level: process.env.LOGGING_STDOUT_LEVEL,
    stream: process.stdout
  }];

  var loggly_stream;

  // only run if config file allows
  if(process.env.LOGGLY_ENABLED) {
    loggly_stream = {
      level: process.env.LOGGLY_LEVEL,
      type: 'raw',
      stream: new Loggly({
        token: process.env.LOGGLY_TOKEN,
        subdomain: process.env.LOGGLY_SUBDOMAIN
      }, process.env.LOGGLY_BUFFER_SIZE || 100)
    };//loggly_stream

    streams.push(loggly_stream);

  } else {

    console.log('Loggly logging is DISABLED.');

  }//if

  var logger = bunyan.createLogger({
    name: hostname,
    hostname: name,
    serializers: {
      err: bunyan.stdSerializers.err,
      req: bunyan.stdSerializers.req,
      res: bunyan.stdSerializers.res
    },
    streams: streams
  });//bunyan.createLogger()

  return logger;
}//get_logger()

module.exports = get_logger;
