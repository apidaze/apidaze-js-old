(function(APIdaze) {
  var WebRTC;

  WebRTC = {};

  WebRTC.URL = window.URL || window.webkitURL || window.msURL || window.oURL;
  WebRTC.RTCPeerConnection = window.PeerConnection || window.webkitPeerConnection00 || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;


  // getUserMedia
  if (window.navigator.webkitGetUserMedia) {
    WebRTC.getUserMedia = window.navigator.webkitGetUserMedia.bind(navigator);
  }
  else if (window.navigator.mozGetUserMedia) {
    WebRTC.getUserMedia = window.navigator.mozGetUserMedia.bind(navigator);
  }
  else if (window.navigator.getUserMedia) {
    WebRTC.getUserMedia = window.navigator.getUserMedia.bind(navigator);
  }

  // RTCSessionDescription
  if (window.webkitRTCSessionDescription) {
    WebRTC.RTCSessionDescription = window.webkitRTCSessionDescription;
  }
  else if (window.mozRTCSessionDescription) {
    WebRTC.RTCSessionDescription = window.mozRTCSessionDescription;
  }
  else if (window.RTCSessionDescription) {
    WebRTC.RTCSessionDescription = window.RTCSessionDescription;
  }

  // New syntax for getting streams in Chrome M26.
  if (WebRTC.RTCPeerConnection && WebRTC.RTCPeerConnection.prototype) {
    if (!WebRTC.RTCPeerConnection.prototype.getLocalStreams) {
      WebRTC.RTCPeerConnection.prototype.getLocalStreams = function() {
        return this.localStreams;
      };
      WebRTC.RTCPeerConnection.prototype.getRemoteStreams = function() {
        return this.remoteStreams;
      };
    }
  }

  // isSupported attribute.
  if (WebRTC.getUserMedia && WebRTC.RTCPeerConnection && WebRTC.RTCSessionDescription) {
    WebRTC.isSupported = true;
  }
  else {
    WebRTC.isSupported = false;
  }

  APIdaze.WebRTC = WebRTC;
}(APIdaze));

