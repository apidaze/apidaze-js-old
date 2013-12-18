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

    APIdaze.EventTarget.call(this);

    var plugin = this;

    this.configuration = APIdaze.Utils.extend({localVideoId: ""}, client.configuration);
    console.log(LOG_PREFIX + "Starting WebRTC");

    if (this.configuration.localVideoId === "") {
      this.configuration.localVideoId = this.createLocalContainer();
    }

    this.bind({
      "onConnected": function(){
        console.log(LOG_PREFIX + "WebSocket connected");
      },
      "onDisconnected": function(event){
        console.log(LOG_PREFIX + "WebSocket closed");
        this.client.status = APIdaze.CLIENT.CONSTANTS.STATUS_NOTREADY;
        this.client.fire({type: "disconnected", data: event.data});
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
      this.socket = new WebSocket(this.wsurl + "?apiKey=" + this.configuration.apiKey + "?token=" + this.configuration.token, "webrtc");
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

        if (json.type && json.type === "answer" && json.command === "getvideostream" && json.sdp) {
          // Reply to a getvideostream command
          // Create an event and pass it to the ConferenceRoom instance
          console.log(LOG_PREFIX + "json.type : " + json.type);
          console.log(LOG_PREFIX + "json.sdp : " + json.sdp);
          var tmpevent = {type: "confbridgegetvideostream", identifier: json.channel, sdp: json.sdp};
          plugin.processEvent(tmpevent);
           
        } else if (json.type && json.type === "answer" && json.sdp) {
          console.log(LOG_PREFIX + "json.type : " + json.type);
          console.log(LOG_PREFIX + "json.sdp : " + json.sdp);
          plugin.peerConnection.setRemoteDescription(new APIdaze.WebRTC.RTCSessionDescription({type:json.type, sdp:json.sdp}));
          console.log(LOG_PREFIX + "peerConnection Remote Description : " + plugin.peerConnection.remoteDescription.sdp);
        } else if (json.event) {
            plugin.processEvent(json.event);
        } else {
          plugin.fire({type:"message", data:event.data});
        }
      });
    } catch(e) {
      throw new APIdaze.Exceptions.InitError("Failed to initialize WebSocket to " + this.wsurl);
    }

    try {
      this.getUserMedia(this.configuration);
    } catch(e) {
      throw e;
    }
  };

  WebRTCAV.prototype = new APIdaze.EventTarget();

  WebRTCAV.prototype.processEvent = function(event) {

    if (event.type.match("^confbridge")) {
      // Pass event to the ConferenceRoom object
      this.room.processEvent(event);
      return;
    }

    if (event.type.match("^channel")) {
      // Pass event to the Call object
      this.callobj.processEvent(event);
      
      if (event.info === 'hangup') {
        /** Grab hangup from the Gateway so we can remove the corresponding stream */
        console.log(LOG_PREFIX + "peerConnection Remote Description : " + this.peerConnection.remoteDescription.sdp);
        var sdp = this.peerConnection.remoteDescription.sdp.replace(/m=audio\s+\d+\s+RTP\/SAVPF/, "m=audio 0 RTP\/SAVPF");
        var sdpbis = sdp.replace(/a=rtpmap.*\n/, "");
        console.log(LOG_PREFIX + "peerConnection Remote Description to be updated: " + sdpbis);
        this.peerConnection.setRemoteDescription(new APIdaze.WebRTC.RTCSessionDescription({type:"offer", sdp:sdp}));

        /** For now, we don't do anything, but need need to figure out
         * a way to close the MediaStream on our PeerConnection here */
//        this.peerConnection.set(sessionDescription); 
      }

      return;
    }

    switch (event.type) {
      default:
        console.log(LOG_PREFIX + "Unknown event : " + JSON.stringify(event));
        console.log("Event type : " + event.type);
        break;
    }
  };

  WebRTCAV.prototype.disconnect = function() {
    this.socket.close(); 
  };

  WebRTCAV.prototype.connect = function() {
    var plugin = this;

    try {
      this.socket = new WebSocket(APIdaze.wsurl + "?apiKey=" + this.configuration.apiKey, "webrtc");
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

        if (plugin.client.configuration.debug === true) {
          console.log(LOG_PREFIX + "S->C : " + event.data);
        }

        if (json.type && json.type === "answer" && json.command === "getvideostream" && json.sdp) {
          // Reply to a getvideostream command
          // Create an event and pass it to the ConferenceRoom instance
          console.log(LOG_PREFIX + "json.type : " + json.type);
          console.log(LOG_PREFIX + "json.sdp : " + json.sdp);
          var tmpevent = {type: "confbridgegetvideostream", identifier: json.channel, sdp: json.sdp};
          plugin.processEvent(tmpevent);
           
        } else if (json.type && json.type === "answer" && json.sdp) {
          console.log(LOG_PREFIX + "json.type : " + json.type);
          console.log(LOG_PREFIX + "json.sdp : " + json.sdp);
          plugin.peerConnection.setRemoteDescription(new APIdaze.WebRTC.RTCSessionDescription({type:json.type, sdp:json.sdp}));
          console.log(LOG_PREFIX + "peerConnection Remote Description : " + plugin.peerConnection.remoteDescription.sdp);
        } else if (json.event) {
            plugin.processEvent(json.event);
        } else {
          plugin.fire({type:"message", data:event.data});
        }
      });
    } catch(e) {
      throw new APIdaze.Exceptions.InitError("Failed to initialize WebSocket to " + APIdaze.wsurl);
    }

  };

  WebRTCAV.prototype.call = function(dest, listeners) {
    this.bind(listeners);
    var tmp = {};
    var apiKey = this.configuration['apiKey'];

    try {
      if (APIdaze.WebRTC.isSupported !== true) {
        throw new APIdaze.Exceptions.InitError("WebRTC not supported here");
      }

      if (apiKey === null || apiKey === '' || typeof apiKey === "undefined") {
        throw new APIdaze.Exceptions.InitError("API key is empty");
      }
      
      tmp['command'] = "dial";
      tmp['apiKey'] = apiKey;
      tmp['userKeys'] = dest;
      tmp['userKeys']['apiKey'] = tmp['apiKey'];
      tmp['type'] = "offer";
      tmp['sdp'] = this.peerConnection.localDescription.sdp;
      var message = JSON.stringify(tmp);
    
      this.sendMessage(message);
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
    tmp['roomname'] = dest['roomName'];
    tmp['identifier'] = dest['nickName'];
    tmp['userKeys'] = dest;
    tmp['userKeys']['apiKey'] = tmp['apiKey'];
    tmp['type'] = "offer";
    tmp['sdp'] = this.peerConnection.localDescription.sdp;
    var message = JSON.stringify(tmp);
    
    this.sendMessage(message);

    return this.room = new APIdaze.ConferenceRoom(this, tmp['roomName'], tmp['identifier'], listeners);
  };

  WebRTCAV.prototype.getUserMedia = function(options) {
    var plugin = this;
    var opts = APIdaze.Utils.extend({audio: true, video: false}, options);
    APIdaze.WebRTC.getUserMedia.call(navigator, opts, 
      // Function called on success
      function(stream) {
        try {
          var container = document.querySelector("#"+ plugin.configuration.localVideoId);

          container.src = APIdaze.WebRTC.URL.createObjectURL(stream);
          plugin.localstream = stream;
          plugin.status *= CONSTANTS.STATUS_LOCALSTREAM_ATTACHED;
          plugin.client.status = APIdaze.CLIENT.CONSTANTS.STATUS_READY;
          console.log(LOG_PREFIX + "getUserMedia called successfully");
        } catch(error) {
          throw new APIdaze.Exceptions.InitError(LOG_PREFIX + "getUserMedia failed with error : " + error.message);
        }
        
        try {
          plugin.createPeerConnection();
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

  WebRTCAV.prototype.createPeerConnection = function() {
    var plugin = this;
//    var pc_config = {"iceServers": [{"url": "stun:stun.l.google.com:19302"}]};
    var pc_config = {"iceServers": [{"url": "stun:173.194.78.127:19302"}]};
    var pc_constraints = {"optional": [{"DtlsSrtpKeyAgreement": false}]};
    var constraints = { "optional": [],
                        "mandatory":  {
                                        "MozDontOfferDataChannel": true,
                                        'OfferToReceiveAudio':true, 
                                        'OfferToReceiveVideo':true
                                      }
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
          plugin.client.fire({type: "ready", data: "none"});
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
        var domId = plugin.createRemoteContainer(mediaStreamEvent.stream.id);
        document.querySelector("#"+domId).src = APIdaze.WebRTC.URL.createObjectURL(mediaStreamEvent.stream);

        /**
         * Add video tracks to new displays
         */
        mediaStreamEvent.stream.onaddtrack = function(mediaTrackEvent) {
          console.log(LOG_PREFIX + "PeerConnection track added : " + mediaTrackEvent.track.id);

          /**
           * Create new MediaStream object from the new video track
           * and attach it to a new container
           * */
          var stream = new APIdaze.WebRTC.MediaStream([mediaTrackEvent.track]);

          domId = plugin.createRemoteContainer(mediaTrackEvent.track.id);
          document.querySelector("#"+domId).src = APIdaze.WebRTC.URL.createObjectURL(stream);
        };
      };
      console.log(LOG_PREFIX + "Listeners added");

      if (this.status | CONSTANTS.STATUS_LOCALSTREAM_ATTACHED) {
        this.peerConnection.addStream(this.localstream);
      } else {
        console.log(LOG_PREFIX + "Localstream not ready, cannot create PeerConnection");
        throw new APIdaze.Exceptions.InitError("WebRTC localstream not ready");
      }

      // temporary measure to remove Moz* constraints in Chrome
      if (window.navigator.webkitGetUserMedia) {
        for (var prop in constraints.mandatory) {
          if (prop.indexOf("Moz") !== -1) {
            delete constraints.mandatory[prop];
          }
        }
      }   

      this.peerConnection.createOffer(function(sessionDescription) {
                                        // Function called on success
                                        plugin.peerConnection.setLocalDescription(sessionDescription); 
                                        // Save this SDP
                                        plugin.localSDP = sessionDescription;
                                      },
                                      function(error) {
                                        // Function called on failure
                                        console.log(LOG_PREFIX + "Failed to create offer : " + error.message);
                                    //  }, constraints);
                                      });
    } catch(error) {
      console.log(LOG_PREFIX + "Failed to create PeerConnection : " + error.toString());
    }
    console.log(LOG_PREFIX + "PeerConnection offer is created");
  };

  WebRTCAV.prototype.createLocalContainer = function() {
    return this.createContainer("local", null);
  };

  WebRTCAV.prototype.createRemoteContainer = function(streamid) {
    return this.createContainer("remote", streamid);
  };

  WebRTCAV.prototype.createContainer = function(type, streamid){

    var webRTC = document.createElement("video");
   
    if (type === "local") {
      webRTC.style.display = "none";
      webRTC.style.width = "100px";
      webRTC.style.height = "75px";
      webRTC.style.border = "1px solid black";
      webRTC.muted = "true";
      webRTC.id = "_apidaze-av-webrtc-local-" + (WebRTCAVCount++);
    } else {
      webRTC.style.display = "none";
      webRTC.style.width = "133";
      webRTC.style.height = "100px";
      webRTC.style.border = "1px solid black";
      var length = this.remoteContainers.push(streamid);
      console.log(LOG_PREFIX + "New member added to remote containers (" + length + " members now).");
      webRTC.id = "_apidaze-av-webrtc-remote-" + length;
    }
    webRTC.autoplay = "autoplay";
    document.body.appendChild(webRTC);

    var container = document.querySelector("#"+webRTC.id);
    return container.id;
  };

  WebRTCAV.prototype.sendMessage = function(message) {
    this.socket.send(message);
    console.log(LOG_PREFIX + "C->S : " + message);
  };

  APIdaze.WebRTCAV = WebRTCAV;

}(APIdaze));

