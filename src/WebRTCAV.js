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

        if (json.type && json.type === "answer" && json.command === "getVideoStreamReply" && json.sdp) {
          // Build a confbridge event out of videoBridge answer, and process it in the room object
          if (client.configuration.debug === true) {
            console.log(LOG_PREFIX + "Got SDP from video MCU : " + json.sdp.replace(/\|/g, "\r\n"));
          }
          json.sdp = json.sdp.replace(/\|/g, "\r\n");
          var newevent = {};
          newevent.type = "confbridgevideostreams";
          newevent.sdp = json.sdp;
          plugin.processEvent(newevent);

        } else if (json.type && json.type === "answer" && json.sdp) {
          console.log(LOG_PREFIX + "json.type : " + json.type);
          console.log(LOG_PREFIX + "json.sdp : " + json.sdp);
          plugin.peerConnection.setRemoteDescription(
              new APIdaze.WebRTC.RTCSessionDescription({type:json.type, sdp:json.sdp}),
              function() { console.log('Remote description set, SDP : ' + plugin.peerConnection.remoteDescription.sdp);},
              function(error) {
                console.log(error.name + ' : ' + error.message);
                // Mozilla error prototype : {name, message}
                for(var propertyName in error) {

                  console.log('Property in error : ' + propertyName);  
                }
              }
          );
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
      console.log(LOG_PREFIX + "Received channel event with info : " + event.info);
      if (typeof event.info === 'string') {
        // Pass event to the Call object
        console.log(LOG_PREFIX + "Passing event to call object");
        this.callobj.processEvent(event);
      } else if (event.info.audiostats !== null) {
        console.log(LOG_PREFIX + "Received audiostats event");
        this.fire({type:"audiostats", data: event.info.audiostats});
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
      tmp['apiVersion'] = APIdaze.version;
      tmp['userKeys'] = dest;
      tmp['userKeys']['apiKey'] = tmp['apiKey'];
      tmp['userKeys']['sounddetect'] = this.configuration['sounddetect'] ? "yes" : "no";
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
    var pc_config = {"iceServers": []};
    var pc_constraints = {
                          "optional": [{"DtlsSrtpKeyAgreement": true}], 
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

  WebRTCAV.prototype.sendMessage = function(message) {
    this.socket.send(message);
    console.log(LOG_PREFIX + "C->S : " + message);
  };

  WebRTCAV.CONSTANTS = CONSTANTS;
  APIdaze.WebRTCAV = WebRTCAV;

}(APIdaze));

