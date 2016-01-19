(function(APIdaze) {
  var LOG_PREFIX = APIdaze.name +' | '+ 'WebRTCAV' +' | ';
  var WebRTCAVCount = 0;
  var CONSTANTS = {
      STATUS_INIT :                 1,
      STATUS_LOCALSTREAM_ATTACHED : 2,
      STATUS_NOTREADY :             4,
      STATUS_CANDIDATES_RECEIVED :  8
    };

  var WebRTCAV = function(client) {
    this.client = client;
    this.remoteContainers = [];
    this.roomPeerConnections = [];
    this.peerConnection = {};
    this.localSDP = "";                 // SDP obtained after creating the main RTCPeerConnection
    this.localstream = {};
    this.configuration = {};
    this.callid = "";
    this.room = null;                   // ConferenceRoom object instantiated by this.joinroom
    this.callobj = null;                // Call object instantiated by this.call
    this.socket = {};
    this.status = CONSTANTS.STATUS_INIT;
    this.wsurl = client.configuration.debug ? APIdaze.dev_wsurl : APIdaze.wsurl;

    if (client.configuration.unsafe === true) {
      console.log(LOG_PREFIX + "Careful, we're connecting the WebSocket over an unencrypted connection!");
      this.wsurl = this.wsurl.replace("wss", "ws").replace("8082", "8081");
    }

    if (client.configuration.forcewsurl && typeof client.configuration.forcewsurl !== "undefined"){
      console.log(LOG_PREFIX + "Asked to force WebSocket URL to " + client.configuration.forcewsurl);
      this.wsurl = client.configuration.forcewsurl;
    }

    APIdaze.EventTarget.call(this);

    var plugin = this;

    this.configuration = APIdaze.Utils.extend({localAudioId: "", localVideoId: ""}, client.configuration);
    console.log(LOG_PREFIX + "Starting WebRTC");

    if (this.configuration.localAudioId === "") {
      this.configuration.localAudioId = this.createAudioLocalElement();
    }

    if (this.configuration.localVideoId === "") {
      this.configuration.localVideoId = this.createVideoLocalElement();
    }

    this.bind({
      "onConnected": function(){
        console.log(LOG_PREFIX + "WebSocket connected");

        var request = {};
        request.wsp_version = "1";
        request.method = "ping";
        request.params = {};
        this.sendMessage(JSON.stringify(request));

        this.client.fire({type: "connected", data: event.data});
      },
      "onDisconnected": function(event){
        console.log(LOG_PREFIX + "WebSocket closed");
        this.client.status = APIdaze.CLIENT.CONSTANTS.STATUS_NOTREADY;
        this.client.fire({type: "disconnected", data: event.data});
      },
      "onAudiostats": function(event) {
        this.client.fire({type: "audiostats", data: event.data});
      }
    });
    if (client.configuration.debug === true) {
      this.bind({
        "onDebug": function(event){
          console.log(LOG_PREFIX + "Debug message: " + event.data);
        },
        "onEvent": function(event){
          console.log(LOG_PREFIX + "Event message: " + event.data);
        }  
      });
    }

    try {
      this.socket = new WebSocket(this.wsurl);
      this.socket.addEventListener("open", function() {
        plugin.fire({type:"connected", data:"none"});
      });
      this.socket.addEventListener("close", function() {
        plugin.fire({type:"disconnected", data:"none"});
      });
      this.socket.addEventListener("message", function(event) {
        /**
         * Process signalling messages internally, and send others
         * to external handlers
         */
        var json = JSON.parse(event.data);

        if (client.configuration.debug === true) {
          console.log(LOG_PREFIX + "S->C : " + event.data);
        }

        if (json.result) {
          // Process reponse after request from gateway
          if (json.result.message) {
            switch (json.result.message) {
              case "pong":
                plugin.client.status = APIdaze.CLIENT.CONSTANTS.STATUS_READY;
                plugin.client.sessid = json.result.sessid;
                plugin.client.fire({type: "ready", data: event.data});
                return;
              default:
                break;
            }
          }
        }

        /**
         * Process SDP answer from gateway WebRTC client
         *
         * SDP can be retrieved from the gateway in "answer", "ringing" and "media" messages
         */
        if (json.method && json.method === "answer" && json.params && json.params.sdp) {
          console.log(LOG_PREFIX + "json.method : " + json.method);
          console.log(LOG_PREFIX + "json.params.sdp : " + json.params.sdp);
          plugin.peerConnection.setRemoteDescription(new APIdaze.WebRTC.RTCSessionDescription({type:"answer", sdp:json.params.sdp}));
          console.log(LOG_PREFIX + "peerConnection Remote Description : " + plugin.peerConnection.remoteDescription.sdp);
        } else if(json.method && json.method === "ringing" && json.params && json.params.sdp) {
          console.log(LOG_PREFIX + "json.method : " + json.method);
          console.log(LOG_PREFIX + "json.params.sdp : " + json.params.sdp);
          plugin.peerConnection.setRemoteDescription(new APIdaze.WebRTC.RTCSessionDescription({type:"answer", sdp:json.params.sdp}));
          console.log(LOG_PREFIX + "peerConnection Remote Description : " + plugin.peerConnection.remoteDescription.sdp);
          plugin.processEvent(json);
        } else if(json.method && json.method === "media" && json.params && json.params.sdp) {
          console.log(LOG_PREFIX + "json.method : " + json.method);
          console.log(LOG_PREFIX + "json.params.sdp : " + json.params.sdp);
          plugin.peerConnection.setRemoteDescription(new APIdaze.WebRTC.RTCSessionDescription({type:"answer", sdp:json.params.sdp}));
          console.log(LOG_PREFIX + "peerConnection Remote Description : " + plugin.peerConnection.remoteDescription.sdp);
          json.method = "ringing";
          plugin.processEvent(json);
        } else {
          plugin.processEvent(json);
        }
      });
    } catch(e) {
      throw new APIdaze.Exceptions.InitError("Failed to initialize WebSocket to " + this.wsurl);
    }
  };

  WebRTCAV.prototype = new APIdaze.EventTarget();

  WebRTCAV.prototype.processEvent = function(event) {
    console.log(LOG_PREFIX + "Processing event : " + JSON.stringify(event));
    if (event.result) {
      console.log(LOG_PREFIX + "typeof event.result.subscribedChannels : " + typeof event.result.subscribedChannels);
      if (typeof event.result.subscribedChannels === "object") {
        console.log(LOG_PREFIX + "We have an array of subscribed channels here.");
        this.callobj.processEvent(event);
      }

      console.log(LOG_PREFIX + "event.id : " + event.id);
      if (event.id === "conference_list_command") {
        // The answer that lists the members of the conference we've joined
        console.log(LOG_PREFIX + "Members : " + event.result.message);
        this.callobj.processEvent(event);
      }

      if (event.result.message) {
        this.callobj.processEvent(event);
      }
    } else if (event.method) {
      switch (event.method) {
        case "answer":
        case "ringing":
        case "hangup":
          // Pass event to the Call object
          this.callobj.processEvent(event);
          break;
        case "event":
          if (event.params === null) {
            console.log(LOG_PREFIX + "Cannot process event : " + JSON.stringify(event));
            break;
          }

          if (event.params.data && event.params.data.action) {
            switch (event.params.data.action) {
              case "add":
                console.log(LOG_PREFIX + "New member joined the conference");
                this.callobj.processEvent(event);
                break;
              case "del":
                console.log(LOG_PREFIX + "New member left the conference");
                this.callobj.processEvent(event);
                break;
              case "modify":
                console.log(LOG_PREFIX + "Modify event");
                this.callobj.processEvent(event);
                break;
            }
          }

          if (event.params.pvtData && event.params.pvtData.action) {
            switch (event.params.pvtData.action) {
              case "conference-liveArray-join":
                console.log(LOG_PREFIX + "Someone with id " + event.params.eventChannel + " joined conference " + event.params.pvtData.laName);
                console.log(LOG_PREFIX + "Is it me you're looking for ? My sessid : " + this.client.sessid);
                var request = {};
                request.wsp_version = "1";
                request.method = "jsapi";
                request.id = "conference_list_command";
                request.params = {
                  command: "fsapi",
                  data: {
                    cmd: "conference",
                    arg: event.params.pvtData.laName + " list"
                  }
                };
                this.sendMessage(JSON.stringify(request));

                request = {};
                request.wsp_version = "1";
                request.method = "verto.subscribe";
                request.id = "subscribe_message";
                request.params = {
                  eventChannel: event.params.pvtData.laChannel,
                  subParams: {}
                };
                this.sendMessage(JSON.stringify(request));
                break;
              default:
                break;
            }
          }
          break;
        default:
          console.log(LOG_PREFIX + "Unknown event : " + JSON.stringify(event));
          console.log("Event type : " + event.method);
          break;
      }
    }
  };

  WebRTCAV.prototype.disconnect = function() {
    this.socket.close(); 
  };

  WebRTCAV.prototype.guid = function() {
    function s4() {
      return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
      s4() + '-' + s4() + s4() + s4();
  };

  WebRTCAV.prototype.call = function(dest, listeners) {
    this.bind(listeners);
    var apiKey = this.configuration['apiKey'];
    this.configuration.request = {};
    var request = this.configuration.request;
    request.wsp_version = "1";
    request.method = "call";
    request.params = {
      apiKey : apiKey,
      apiVersion : APIdaze.version,
      userKeys : dest,
      callID: this.guid()
    };

    try {
      this.getUserMedia(this.configuration);
    } catch(e) {
      throw new APIdaze.Exceptions.InitError("Failed to get user media");
    }

    try {
      if (APIdaze.WebRTC.isSupported !== true) {
        throw new APIdaze.Exceptions.InitError("WebRTC not supported here");
      }

      if (apiKey === null || apiKey === '' || typeof apiKey === "undefined") {
        throw new APIdaze.Exceptions.InitError("API key is empty");
      }

    } catch (e) {
      console.log(LOG_PREFIX + "Exception received : " + e.message);
    }

    return this.callobj = new APIdaze.Call(this, listeners);
  };

  WebRTCAV.prototype.joinroom = function(dest, listeners) {
    if (APIdaze.WebRTC.isSupported !== true) {
      throw new APIdaze.Exceptions.InitError("WebRTC not supported here");
    }

    var apiKey = this.configuration['apiKey'];
    var tmp = {};
    tmp['command'] = "joinroom";
    tmp['apiKey'] = apiKey;
    tmp['apiVersion'] = APIdaze.version;
    tmp['roomname'] = dest['roomName'];
    tmp['identifier'] = dest['nickName'];
    tmp['userKeys'] = dest;
    tmp['userKeys']['apiKey'] = tmp['apiKey'];
    tmp['userKeys']['sounddetect'] = this.configuration['sounddetect'] ? "yes" : "no";
    tmp['type'] = "offer";
    tmp['sdp'] = this.peerConnection.localDescription.sdp;
    var message = JSON.stringify(tmp);
    
    this.sendMessage(message);

    return this.room = new APIdaze.ConferenceRoom(this, tmp['roomname'], tmp['identifier'], listeners);
  };

  WebRTCAV.prototype.getUserMedia = function(options) {
    var plugin = this;
    var opts = APIdaze.Utils.extend({audio: true, video: false}, options);
    APIdaze.WebRTC.getUserMedia.call(navigator, opts, 
      // Function called on success
      function(stream) {
        try {
          var container = document.querySelector("#"+ plugin.configuration.localAudioId);

          APIdaze.WebRTC.attachMediaStream(container, stream);
          plugin.localstream = stream;
          plugin.status *= CONSTANTS.STATUS_LOCALSTREAM_ATTACHED;
          console.log(LOG_PREFIX + "getUserMedia called successfully");
        } catch(error) {
          throw new APIdaze.Exceptions.InitError(LOG_PREFIX + "getUserMedia failed with error : " + error.message);
        }
        
        try {
          plugin.createPeerConnection(options.request);
        } catch(error) {
          throw new APIdaze.Exceptions.InitError(LOG_PREFIX + "createPeerConnection failed with error : " + error.message);
        }

      }, 
      // Function called on failure
      function(error) {
        console.log(LOG_PREFIX + "getUsermedia failed with error.name : " + error.name + " - error.message : " + error.message + " - error.constraintName : " + error.constraintName);
        plugin.client.fire({type: "error", component: "getUserMedia", name: error.name, message: error.message, constraintName: error.constraintName});
      }
    );
  };

  WebRTCAV.prototype.createPeerConnection = function(request) {
    var plugin = this;
    var pc_config = {"iceServers": []};
    var pc_constraints = {
                          "optional": [{"DtlsSrtpKeyAgreement": true}, {"googIPv6": false}],
                          "mandatory":  { 'OfferToReceiveAudio':true,  'OfferToReceiveVideo':false}
                         };

    console.log(LOG_PREFIX + "Creating PeerConnection...");
    try {
      this.peerConnection = new APIdaze.WebRTC.RTCPeerConnection(pc_config, pc_constraints);

      /**
      * Create various callback functions, the most important
      * being onicecandidate as we send our SDP offer once
      * all candidates are gathered.
      */
      this.peerConnection.onicecandidate = function(event) {
        if (event.candidate) {
          console.log(LOG_PREFIX + "ICE candidate received: " + event.candidate.candidate);
        } else {
          console.log(LOG_PREFIX + "No more ICE candidate");
          plugin.status = plugin.status * CONSTANTS.STATUS_CANDIDATES_RECEIVED;
          request.params.sdp = plugin.peerConnection.localDescription.sdp;
          plugin.sendMessage(JSON.stringify(request));
        }
      };

      this.peerConnection.onopen = function() {
        console.log(LOG_PREFIX + "PeerConnection open");
      };

      this.peerConnection.onstatechange = function() {
        console.log(LOG_PREFIX + "PeerConnection state changed");
      };

      this.peerConnection.onremovestream = function(stream) {
        console.log(LOG_PREFIX + "PeerConnection stream removed : " + stream);
      };

      this.peerConnection.onaddstream = function(mediaStreamEvent) {
        console.log(LOG_PREFIX + "PeerConnection stream added : " + mediaStreamEvent.stream.id);
        var domId = plugin.createAudioRemoteElement(mediaStreamEvent.stream.id);
        APIdaze.WebRTC.attachMediaStream(document.querySelector("#"+domId), mediaStreamEvent.stream);
      };

      console.log(LOG_PREFIX + "Listeners added");

      if (this.status | CONSTANTS.STATUS_LOCALSTREAM_ATTACHED) {
        this.peerConnection.addStream(this.localstream);
      } else {
        console.log(LOG_PREFIX + "Localstream not ready, cannot create PeerConnection");
        throw new APIdaze.Exceptions.InitError("WebRTC localstream not ready");
      }

      this.peerConnection.createOffer(function(sessionDescription) {
                                          // Function called on success
                                          plugin.peerConnection.setLocalDescription(sessionDescription); 
                                          // Save this SDP
                                          plugin.localSDP = sessionDescription.sdp;
                                          console.log(LOG_PREFIX + "Local SDP : " + sessionDescription.sdp);
                                        },
                                        function(error) {
                                          // Function called on failure
                                          console.log(LOG_PREFIX + "Failed to create offer : " + error.message);
                                        }
                                      );
    } catch(error) {
      console.log(LOG_PREFIX + "Failed to create PeerConnection : " + error.toString());
    }
    console.log(LOG_PREFIX + "PeerConnection offer is created");
    console.log(LOG_PREFIX + "Local SDP : " + this.localSDP);
  };

  WebRTCAV.prototype.resetPeerConnection = function() {
    this.peerConnection.close();
    this.peerConnection = null;

    try {
      this.createPeerConnection();
    } catch(error) {
      throw new APIdaze.Exceptions.InitError(LOG_PREFIX + "createPeerConnection failed with error : " + error.message);
    }
  };

  WebRTCAV.prototype.createAudioLocalElement = function() {
    return this.createAVElement("audio", "local", null);
  };

  WebRTCAV.prototype.createVideoLocalElement = function() {
    return this.createAVElement("video", "local", null);
  };

  WebRTCAV.prototype.createAudioRemoteElement = function(streamid) {
    return this.createAVElement("audio", "remote", streamid);
  };

  WebRTCAV.prototype.createVideoRemoteElement = function(streamid, containerId) {
    return this.createAVElement("video", "remote", streamid, containerId);
  };

  /**
   * Create and audio or video DOM element.
   *
   * The element is created and inserted in the document. Depending on the
   * options, it can be interted under document.body or another DOM element.
   *
   * NOTE : can we configure the video size here too?
   */
  WebRTCAV.prototype.createAVElement = function(mediatype, type, streamid, containerId){

    var webRTC = document.createElement("video");
   
    if (type === "local") {
      webRTC.style.display = "none";
      webRTC.style.width = "100px";
      webRTC.style.height = "75px";
      webRTC.style.border = "1px solid black";
      webRTC.muted = "true";
      webRTC.id = "_apidaze-av-webrtc-local-" + (WebRTCAVCount++);
      webRTC.autoplay = "autoplay";
      document.body.appendChild(webRTC);
    } else {
      if (mediatype === "video") {
        webRTC.style.width = "266px";
        webRTC.style.height = "150px";
        webRTC.style.border = "1px solid black";
        webRTC.id = "_apidaze-video-webrtc-remote-" + streamid;
        webRTC.autoplay = "autoplay";
        var container = document.querySelector("#" + containerId);
        container.appendChild(webRTC);
      } else {
        webRTC.style.display = "none";
        webRTC.style.width = "133px";
        webRTC.style.height = "100px";
        webRTC.style.border = "1px solid black";
        webRTC.id = "_apidaze-audio-webrtc-remote-" + streamid;
        webRTC.autoplay = "autoplay";
        document.body.appendChild(webRTC);
      }

      var length = this.remoteContainers.push(webRTC.id);
      console.log(LOG_PREFIX + "New member added to remote containers (" + length + " members now).");
    }

    return webRTC.id;
  };

  WebRTCAV.prototype.muteAudioMic = function() {
    var i = 0;
    for (i = 0; i < this.localstream.getAudioTracks().length; i++){
      console.log(LOG_PREFIX + "Muting audio tracks locally");
      this.localstream.getAudioTracks()[i].enabled = false;
    }
  };

  WebRTCAV.prototype.unMuteAudioMic = function() {
    var i = 0;
    for (i = 0; i < this.localstream.getAudioTracks().length; i++){
      console.log(LOG_PREFIX + "Un-muting audio tracks locally");
      this.localstream.getAudioTracks()[i].enabled = true;
    }
  };

  WebRTCAV.prototype.muteAudioOut = function() {
    var allVideos = document.getElementsByTagName("video");
    var i = 0;
    for (i = 0; i < allVideos.length; i++) {
      var id = allVideos[i].id;
      if (id.slice(0, "_apidaze-audio-webrtc-remote-".length) === "_apidaze-audio-webrtc-remote-") {
        console.log(LOG_PREFIX + "DOM id of element to mute : " + id);
        allVideos[i].muted = true;
      }
    }
  };

  WebRTCAV.prototype.unMuteAudioOut = function() {
    var allVideos = document.getElementsByTagName("video");
    var i = 0;
    for (i = 0; i < allVideos.length; i++) {
      var id = allVideos[i].id;
      if (id.slice(0, "_apidaze-audio-webrtc-remote-".length) === "_apidaze-audio-webrtc-remote-") {
        console.log(LOG_PREFIX + "DOM id of element to unmute : " + id);
        allVideos[i].muted = false;
      }
    }
  };

  WebRTCAV.prototype.freeDOM = function() {
    var elem = document.getElementById('_apidaze-av-webrtc-local-0');
    elem.parentNode.removeChild(elem);
    WebRTCAVCount--;

    elem = document.getElementById('_apidaze-av-webrtc-local-1');
    elem.parentNode.removeChild(elem);
    WebRTCAVCount--;

    this.peerConnection.removeStream(this.localstream);

    for (var i = 0; i < this.remoteContainers.length; i++) {
      console.log(LOG_PREFIX + "DOM element to remove : " + this.remoteContainers[i]);
      elem = document.getElementById(this.remoteContainers[i]);
      elem.parentNode.removeChild(elem);
    }
  };

  WebRTCAV.prototype.freeALL = function() {
    var elem = document.getElementById('_apidaze-av-webrtc-local-0');
    elem.parentNode.removeChild(elem);
    WebRTCAVCount--;

    elem = document.getElementById('_apidaze-av-webrtc-local-1');
    elem.parentNode.removeChild(elem);
    WebRTCAVCount--;

    if (this.peerConnection === null || typeof this.peerConnection === "undefined" || this.peerConnection.removeStream === null || typeof this.peerConnection.removeStream === "undefined") {
      return;
    }

    this.peerConnection.removeStream(this.localstream);

    for (var i = 0; i < this.remoteContainers.length; i++) {
      console.log(LOG_PREFIX + "DOM element to remove : " + this.remoteContainers[i]);
      elem = document.getElementById(this.remoteContainers[i]);
      elem.parentNode.removeChild(elem);
    }

    this.peerConnection.close();
    this.peerConnection = null;
  };

  WebRTCAV.prototype.sendMessage = function(message) {
    this.socket.send(message);
    console.log(LOG_PREFIX + "C->S : " + message);
  };

  WebRTCAV.CONSTANTS = CONSTANTS;
  APIdaze.WebRTCAV = WebRTCAV;

}(APIdaze));

