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
      get: function(){ return '94.23.192.150:81'; }
    },
    wshostport: {
      get: function(){ return '94.23.192.150:8088'; }
    },
    swfurl: {
      get: function(){ return 'http://' + this.flashhostport + '/apidaze/apidaze.swf'; }
    },
    swfurl_rtmfp: {
      get: function(){ return 'http://' + this.flashhostport + '/rtmfp/apidaze.swf'; }
    },
    rtmpurl: {
      get: function(){ return 'rtmp://94.23.192.150/phone'; }
    },
    rtmfpurl: {
      get: function(){ return 'rtmfp://94.23.192.150/apidaze'; }
    },
    wsurl: {
      get: function(){ return 'ws://' + this.wshostport + '/websocket'; }
    },
    dev_flashhostport: {
      get: function(){ return '195.5.246.235:81'; }
    },
    dev_wshostport: {
      get: function(){ return '195.5.246.235:8088'; }
    },
    dev_swfurl: {
      get: function(){ return 'http://' + this.dev_flashhostport + '/rtmp/apidaze.swf'; }
    },
    dev_swfurl_rtmfp: {
      get: function(){ return 'http://' + this.dev_flashhostport + '/rtmfp/apidaze.swf'; }
    },
    dev_rtmpurl: {
      get: function(){ return 'rtmp://195.5.246.235/phone'; }
    },
    dev_rtmfpurl: {
      get: function(){ return 'rtmfp://195.5.246.235/apidaze'; }
    },
    dev_wsurl: {
      get: function(){ return 'ws://' + this.dev_wshostport + '/websocket'; }
    },
    maxroomparticipants: {
      get: function(){ return 4; }
    }
  });

  return APIdaze;
}());
