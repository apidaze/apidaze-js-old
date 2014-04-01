/*global MediaStream: false */
/*global webkitMediaStream: false */
(function(APIdaze) {

  /**
  * adapter.js
  * https://code.google.com/p/webrtc/source/browse/trunk/samples/js/base/adapter.js
  * http://www.webrtc.org/interop
  */

  var WebRTC = {};
  var LOG_PREFIX = APIdaze.name +' | '+ 'WebRTCAdapter' +' | ';

  WebRTC.RTCPeerConnection = null;
  WebRTC.RTCSessionDescription = null;
  WebRTC.getUserMedia = null;
  WebRTC.attachMediaStream = null;
  WebRTC.reattachMediaStream = null;
  WebRTC.webrtcDetectedBrowser = null;
  WebRTC.webrtcDetectedVersion = null;
  WebRTC.URL = null;

  if (navigator.mozGetUserMedia) {
    console.log(LOG_PREFIX + "This appears to be Firefox");

    WebRTC.webrtcDetectedBrowser = "firefox";

    // The RTCPeerConnection object.
    WebRTC.RTCPeerConnection = window.mozRTCPeerConnection;

    // The RTCSessionDescription object.
    WebRTC.RTCSessionDescription = window.mozRTCSessionDescription;

    // The RTCIceCandidate object.
    WebRTC.RTCIceCandidate = window.mozRTCIceCandidate;

    // Get UserMedia (only difference is the prefix).
    // Code from Adam Barth.
    WebRTC.getUserMedia = navigator.mozGetUserMedia.bind(navigator);

    WebRTC.URL = window.URL;

    // Creates Turn Uri with new turn format.
    WebRTC.createIceServer = function(turn_url, username, password) {
      var iceServer = { 'url': turn_url,
        'credential': password,
        'username': username };
        return iceServer;
    };

    // Attach a media stream to an element.
    WebRTC.attachMediaStream = function(element, stream) {
      console.log(LOG_PREFIX + "Attaching media stream (Mozilla fashion)");
      element.mozSrcObject = stream;
      element.play();
    };

    WebRTC.reattachMediaStream = function(to, from) {
      console.log(LOG_PREFIX + "Reattaching media stream");
      to.mozSrcObject = from.mozSrcObject;
      to.play();
    };

    // Fake get{Video,Audio}Tracks
    MediaStream.prototype.getVideoTracks = function() {
      return [];
    };

    MediaStream.prototype.getAudioTracks = function() {
      return [];
    };
  } else if (navigator.webkitGetUserMedia) {
    console.log(LOG_PREFIX + "This appears to be Chrome");

    WebRTC.webrtcDetectedBrowser = "chrome";
    WebRTC.webrtcDetectedVersion = parseInt(navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./)[2], 10);
    WebRTC.URL = window.webkitURL;

    // For pre-M28 chrome versions use old turn format, else use the new format.
    if (WebRTC.webrtcDetectedVersion < 28) {
      WebRTC.createIceServer = function(turn_url, username, password) {
        var iceServer = { 'url': 'turn:' + username + '@' + turn_url,
          'credential': password };
          return iceServer;
      };
    } else {
      WebRTC.createIceServer = function(turn_url, username, password) {
        var iceServer = { 'url': turn_url,
          'credential': password,
          'username': username };
          return iceServer;
      };
    }

    // The RTCPeerConnection object.
    WebRTC.RTCPeerConnection = window.webkitRTCPeerConnection;

    // The RTCSessionDescription object.
    WebRTC.RTCSessionDescription = window.RTCSessionDescription;

    // The MediaStream object.
    WebRTC.MediaStream = window.webkitMediaStream;

    // Get UserMedia (only difference is the prefix).
    // Code from Adam Barth.
    WebRTC.getUserMedia = navigator.webkitGetUserMedia.bind(navigator);

    // Attach a media stream to an element.
    WebRTC.attachMediaStream = function(element, stream) {
      if (typeof element.srcObject !== 'undefined') {
        element.srcObject = stream;
      } else if (typeof element.mozSrcObject !== 'undefined') {
        element.mozSrcObject = stream;
      } else if (typeof element.src !== 'undefined') {
        console.log(LOG_PREFIX + "Attaching media stream (Chrome fashion)");
        element.src = WebRTC.URL.createObjectURL(stream);
      } else {
        console.log(LOG_PREFIX + "Error attaching stream to element.");
      }
    };

    WebRTC.reattachMediaStream = function(to, from) {
      to.src = from.src;
    };

    // The representation of tracks in a stream is changed in M26.
    // Unify them for earlier Chrome versions in the coexisting period.
    if (!webkitMediaStream.prototype.getVideoTracks) {
      webkitMediaStream.prototype.getVideoTracks = function() {
        return this.videoTracks;
      };
      webkitMediaStream.prototype.getAudioTracks = function() {
        return this.audioTracks;
      };
    }

    // New syntax of getXXXStreams method in M26.
    if (!window.webkitRTCPeerConnection.prototype.getLocalStreams) {
      window.webkitRTCPeerConnection.prototype.getLocalStreams = function() {
        return this.localStreams;
      };
      window.webkitRTCPeerConnection.prototype.getRemoteStreams = function() {
        return this.remoteStreams;
      };
    }
  } else {
    console.log(LOG_PREFIX + "Browser does not appear to be WebRTC-capable");
  }

  // isSupported attribute.
   
  if (WebRTC.getUserMedia && WebRTC.RTCPeerConnection && WebRTC.RTCSessionDescription) {
    console.log(LOG_PREFIX + "WebRTC supported");
    WebRTC.isSupported = true;
  }
  else {
    console.log(LOG_PREFIX + "WebRTC NOT supported. Expect bad things.");
    WebRTC.isSupported = false;
  }

  APIdaze.WebRTC = WebRTC;

}(APIdaze));
