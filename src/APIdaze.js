/*global console: false*/

(function(window){

var APIdaze = (function() {
  "use strict";

  var APIdaze = {};

  Object.defineProperties(APIdaze, {
    version: {
      get: function(){ return '<%= pkg.version %>'; }
    },
    name: {
      get: function(){ return '<%= pkg.name %>'; }
    },
    flashhostport: {
      get: function(){ return 'ws2.apidaze.io:81'; }
    },
    wshostport: {
      get: function(){ return 'ws2.apidaze.io:8089'; }
    },
    swfurl: {
      get: function(){ return 'http://' + this.flashhostport + '/apidaze/apidaze.swf'; }
    },
    swfurl_rtmfp: {
      get: function(){ return 'http://' + this.flashhostport + '/rtmfp/apidaze.swf'; }
    },
    rtmpurl: {
      get: function(){ return 'rtmp://ws2.apidaze.io/phone'; }
    },
    rtmfpurl: {
      get: function(){ return 'rtmfp://ws2.apidaze.io/apidaze'; }
    },
    wsurl: {
      get: function(){ return 'wss://' + this.wshostport + '/websocket'; }
    },
    dev_flashhostport: {
      get: function(){ return 'ws2.apidaze.io:81'; }
    },
    dev_wshostport: {
      get: function(){ return 'ws2.apidaze.io:8089'; }
    },
    dev_swfurl: {
      get: function(){ return 'http://' + this.dev_flashhostport + '/rtmp/apidaze.swf'; }
    },
    dev_swfurl_rtmfp: {
      get: function(){ return 'http://' + this.dev_flashhostport + '/rtmfp/apidaze.swf'; }
    },
    dev_rtmpurl: {
      get: function(){ return 'rtmp://ws2.apidaze.io/phone'; }
    },
    dev_rtmfpurl: {
      get: function(){ return 'rtmfp://ws2.apidaze.io/apidaze'; }
    },
    dev_wsurl: {
      get: function(){ return 'wss://' + this.dev_wshostport + '/websocket'; }
    },
    maxroomparticipants: {
      get: function(){ return 4; }
    }
  });

  return APIdaze;
}());
