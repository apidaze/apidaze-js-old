(function(APIdaze) {
  var LOG_PREFIX = APIdaze.name +' | '+ 'ConferenceRoom' +' | ';

  var ConferenceRoom = function(clientInstance, roomName, identifier, listeners) {
    this.clientType = clientInstance.client.configuration.type === "webrtc" ? "webrtc" : "flash";
    this.webRTCClient = clientInstance.client.configuration.type === "webrtc" ? clientInstance : null;
    this.flashClient = clientInstance.client.configuration.type === "flash" ? clientInstance : null;
    this.configuration = {};            // Valid options : videoContainerId, mode (sendrecv, recvonly)
    this.maxParticipants = APIdaze.maxroomparticipants;
    this.myAstChannelID = "";
    this.roomIdentifier = identifier;
    this.roomName = roomName;
    this.videoPeerConnection = {};      // A dedicated PeerConnection for video
    this.remoteVideoSDP = "";
    this.localVideoSDP = "";            // SDP obtained after creating the main Video RTCPeerConnection
    this.localVideoStream = {};
    this.videoOfferNum = 0;
    this.videoBridgeMsid = "";          // Video stream ID set by the videoBridge when empty. Must be replaced by user's stream id
    this.myVideoBridgeSSRC = "";        // The SSRC of the video stream published by this instance
    this.myVideoBridgeChannelID = "";   // The Channel ID of this instance on the video bridge
    this.roomastchannick = {};          // An associative array that matches nicknames with Asterisk Channels
    this.videostarted = false;

    APIdaze.EventTarget.call(this);

    this.bind(listeners);

  };

  ConferenceRoom.prototype = new APIdaze.EventTarget();

  /**
   * Call getUserMedia, create the Video peerConnection.
   *
   * The configuration object passed as an argument contains the following options :
   * - videoContainerId : the DOM id of the elements containing the various video
   *   tags
   */
  ConferenceRoom.prototype.joinInVideo = function(configuration, listeners) {
    var self = this;
    var opts = {audio: false, video: true}; 
    opts.video = {mandatory: {}};   // Same behavior as true
    opts.video.mandatory.minWidth = 640;
    opts.video.mandatory.minHeight = 360;
    opts.video.mandatory.minAspectRatio = 1.77;

    this.configuration = APIdaze.Utils.extend({videoContainerId: "_apidaze-video-container", mode: "sendrecv"}, configuration);
    
    if (this.clientType !== "webrtc") {
      throw new APIdaze.Exceptions.InitError(LOG_PREFIX + "Method not available to non WebRTC clients");
    }

    if (this.videostarted === true) {
      throw new APIdaze.Exceptions.InitError(LOG_PREFIX + "Video offer already sent");
    }

    this.videostarted = true;

    this.bind(listeners);

    if (this.configuration.mode !== "sendrecv" && this.configuration.mode !== "recvonly") {
      this.configuration.mode = "sendrecv";
    }

    var container = document.querySelector("#" + this.configuration.videoContainerId);
    if (container === null) {
      console.log(LOG_PREFIX + "Video container does not exist or invalid, let's create it.");
      var div = document.createElement('div');
      div.id = this.configuration.videoContainerId;
      document.body.appendChild(div);
    }

    // Call getUserMedia for our video conference. On success, create the video PeerConnection. 
    APIdaze.WebRTC.getUserMedia.call(navigator, opts, 
        // Function called on success
        function(stream) {
          try {
            var container = document.querySelector("#" + self.webRTCClient.configuration.localVideoId);

            container.src = APIdaze.WebRTC.URL.createObjectURL(stream);
            self.localVideoStream = stream;
            console.log(LOG_PREFIX + "getUserMedia (video) called successfully");
          } catch(error) {
            throw new APIdaze.Exceptions.InitError(LOG_PREFIX + "getUserMedia (video) failed with error : " + error.message);
          }

          try {
            self.createVideoPeerConnection();
          } catch(error) {
            throw new APIdaze.Exceptions.InitError(LOG_PREFIX + "createPeerConnection failed with error : " + error.message);
          }

        }, 
        // Function called on failure
        function(error) {
          console.log(LOG_PREFIX + "getUsermedia (video) failed with error : " + error.name + " - error.message : " + error.message + " - error.constraintName : " + error.constraintName);
          self.webRTCClient.client.fire({type: "error", component: "getUserMedia", name: error.name, message: error.message, constraintName: error.constraintName});
        }
    );
  };

  /**
   * Create the video PeerConnection for this room.
   *
   * Use our STUN server in priority, fallback to Google if we're unreachable. 
   * We gather all our ICE candidates, set up our listeners to all the WebRTC
   * related events (new media stream, removal), add our local video to the 
   * Peer Connection, create our local SDP offer and eventually send it to the
   * signalling server.
   */
  ConferenceRoom.prototype.createVideoPeerConnection = function() {
    var self = this;
    var pc_config = {"iceServers": []};

    console.log(LOG_PREFIX + "Creating VideoPeerConnection...");
    try {
      this.videoPeerConnection = new APIdaze.WebRTC.RTCPeerConnection(pc_config, {'mandatory': {'OfferToReceiveAudio':false, 'OfferToReceiveVideo':true}});

       /* Create various callback functions, the most important
        * being onicecandidate as we send our SDP offer once
        * all candidates are gathered. */
      this.videoPeerConnection.onicecandidate = function(event) {
        if (event.candidate) {
          console.log(LOG_PREFIX + "ICE candidate received: " + event.candidate.candidate);
        } else {
          /* At this stage, we received all the candidates and therefore
           * we're ready to signal our presence to the video bridge 
           * and the JavaScript program. */
          console.log(LOG_PREFIX + "No more ICE candidate");
          self.webRTCClient.status = self.webRTCClient.status * APIdaze.WebRTCAV.CONSTANTS.STATUS_CANDIDATES_RECEIVED;
          self.webRTCClient.client.fire({type: "ready", data: "none"});
          self.localVideoSDP = self.videoPeerConnection.localDescription.sdp;
          console.log(LOG_PREFIX + "Local video SDP : " + self.localVideoSDP);
          var tmp = {};
          tmp['command'] = "getvideostream";
          tmp['apiKey'] = self.webRTCClient.configuration['apiKey'];
          tmp['roomname'] = self.roomName;
          tmp['identifier'] = self.roomIdentifier;
          tmp['channel'] = self.roomIdentifier;
          tmp['userKeys'] = {};
          tmp['userKeys']['apiKey'] = tmp['apiKey'];
          //tmp['userKeys']['sounddetect'] = this.configuration['sounddetect'] ? "yes" : "no";
          tmp['type'] = "offer";
          // Replace line terminating characters with | to make Asterisk happy.
          tmp['sdp'] = self.videoPeerConnection.localDescription.sdp.replace(/\r\n/g, "|");
          var message = JSON.stringify(tmp);

          self.webRTCClient.sendMessage(message);
        }
      };

      this.videoPeerConnection.onopen = function() {
        console.log(LOG_PREFIX + "VideoPeerConnection open");
      };

      this.videoPeerConnection.onstatechange = function() {
        console.log(LOG_PREFIX + "VideoPeerConnection state changed");
      };

      this.videoPeerConnection.onremovestream = function(mediaStreamEvent) {
        console.log(LOG_PREFIX + "Video PeerConnection stream removed : " + mediaStreamEvent.stream.id);
        if (mediaStreamEvent.stream.id === "34IQ1WaD8ZmokM24") {
          // Ignore this stream id, given back first by the video bridge
          return;
        }

        var element = document.querySelector("#_apidaze-video-webrtc-remote-" + mediaStreamEvent.stream.id);
        var parent = document.querySelector("#" + self.configuration.videoContainerId);
        parent.removeChild(element);
        element = null;
      };

      this.videoPeerConnection.onaddstream = function(mediaStreamEvent) {
        console.log(LOG_PREFIX + "Video PeerConnection stream added : " + mediaStreamEvent.stream.id);
        if (mediaStreamEvent.stream.id === "34IQ1WaD8ZmokM24") {
          // Ignore this stream id, given back first by the video bridge
          return;
        }

        var domId = self.webRTCClient.createVideoRemoteElement(mediaStreamEvent.stream.id, self.configuration.videoContainerId);
        document.querySelector("#"+domId).src = APIdaze.WebRTC.URL.createObjectURL(mediaStreamEvent.stream);
      };

      console.log(LOG_PREFIX + "Listeners added");

      if (self.webRTCClient.status | APIdaze.WebRTCAV.CONSTANTS.STATUS_LOCALSTREAM_ATTACHED) {
        if (this.configuration.mode === "sendrecv") {
          this.videoPeerConnection.addStream(this.localVideoStream);
        }
      } else {
        console.log(LOG_PREFIX + "Localstream not ready, cannot create Video PeerConnection");
        throw new APIdaze.Exceptions.InitError("WebRTC localstream not ready");
      }

      this.videoPeerConnection.createOffer(
          function(sessionDescription) {
            // Function called on success
            self.videoPeerConnection.setLocalDescription(sessionDescription); 
            console.log(LOG_PREFIX + "SDP for local offer : " + sessionDescription.sdp);
          },
          function(error) {
            // Function called on failure
            console.log(LOG_PREFIX + "Failed to create offer : " + error.message);
          }, {'mandatory': {'OfferToReceiveAudio':false, 'OfferToReceiveVideo':true}});
    } catch(error) {
      console.log(LOG_PREFIX + "Failed to create Video PeerConnection : " + error.toString());
    }
    console.log(LOG_PREFIX + "Video PeerConnection offer is created");
  };

  /**
   * Send a text message to the room participants.
   *
   * The message type can be public if we want to send it to all participants,
   * or private if we want to send it to a given participant in private.
   *
   * NOTE : private mode not yet implemented.
   */
  ConferenceRoom.prototype.sendMessage = function(type, astchannelto, message, from) {
    var client = this.clientType === "webrtc" ? this.webRTCClient : this.flashClient;

    var tmp = {};
    tmp['command'] = "sendtext";
    tmp['type'] = "public";
    tmp['destination'] = type === "private" ? astchannelto : this.roomName;
    tmp['apiKey'] = client.configuration['apiKey'];
    tmp['roomname'] = this.roomName;
    tmp['from'] = typeof from !== 'undefined' ? from : this.roomIdentifier;
    tmp['astchannel'] = this.myAstChannelID;
    tmp['userKeys'] = {};
    tmp['userKeys']['apiKey'] = tmp['apiKey'];
    tmp['text'] = message;
    var msg = JSON.stringify(tmp);

    client.sendMessage(msg);
  };

  /**
   * Send a DTMF to the room : not implemented yet
   */
  ConferenceRoom.prototype.sendDTMF = function(dtmf) {
    var tmp = {};
    tmp['command'] = "senddtmf";
    tmp['dtmf'] = dtmf;
    var message = JSON.stringify(tmp);

    this.webRTCClient.sendMessage(message);
  };

  /**
   * Process events received from the room.
   *
   * Events which are processed here :
   *  confbridgewelcome : retrieve our Asterisk channel identifier
   *  confbridgejoin/confbridgeleave :  who enters and leaves the conference room
   *  confbridgemembers : get the list of the participants
   *  confbridgetalking : who is talking in the conference room
   *  confbridgevideomembers : get the list of the video participants
   *  confbridgevideostreams : the first answer from the video bridge (like a welcome message :))
   *  confbridgenewssrc/confbridgeleftssrc : the SSRCs of the video streams that come in and out
   *  confbridgetextmessage : process incoming text messages
   *  confbridgevideostatusupdate : enable/disable video for a stream
   *
   *  Most events fire a new event to the JavaScript program.
   */
  ConferenceRoom.prototype.processEvent = function(event) {
    var self = this;
    switch (event.type) {
      case "confbridgewelcome":
        // Just set my Asterisk channel identifier
        console.log(LOG_PREFIX + "My channel identifier in room " + event.room + " : " + event.identifier);
        this.myAstChannelID = event.identifier;
        this.fire({type: "confbridgewelcome", data: JSON.stringify({room: event.room, channel: event.identifier})});
        break;
      case "confbridgejoin":
        console.log(LOG_PREFIX + "Someone (" + event.channel + ") entered room " + event.room + ".");
        this.roomastchannick[event.channel] = {nickname: event.name, number: event.number};
        this.fire({type: "confbridgejoin", data: JSON.stringify({room: event.room, channel: event.channel, name: event.name, number: event.number})});
        break;
      case "confbridgeleave":
        console.log(LOG_PREFIX + "Someone (" + event.channel +") left room " + event.room + ".");
        delete this.roomastchannick[event.channel]; 
        this.fire({type: "confbridgeleave", data: JSON.stringify({room: event.room, channel: event.channel, name: event.name, number: event.number})});
        break;
      case "confbridgemembers":
        console.log(LOG_PREFIX + "Room " + event.room + " members : " + JSON.stringify(event.members));
        this.fire({type: "confbridgemembers", data: JSON.stringify({room: event.room, members: event.members})});
        break;
      case "confbridgetalking":
        console.log(LOG_PREFIX + event.channel + " talkingstatus : " + event.talkingstatus);
        this.fire({type: "confbridgetalking", data: JSON.stringify({room: event.room, channel: event.channel, talkingstatus: event.talkingstatus})});
        break;
      case "confbridgevideomembers":
        console.log(LOG_PREFIX + "Video members : " + JSON.stringify(event.members));
        for (var i in event.members) {
          if (event.members[i].channel === this.myAstChannelID) {
            console.log(LOG_PREFIX + "My SSRC on the video bridge : " + event.members[i].ssrc);
            console.log(LOG_PREFIX + "My channel ID on the video bridge : " + event.members[i].msid);
            this.myVideoBridgeSSRC = event.members[i].ssrc;
            this.myVideoBridgeChannelID = event.members[i].msid;
            break;
          }
        }
        this.fire({type: "confbridgevideomembers", data: JSON.stringify({room: this.roomName, members: event.members})});
        break;
      case "confbridgevideostreams":
        // First anwer to our getVideoStreams command
        this.remoteVideoSDP = event.sdp;
        this.videoPeerConnection.setRemoteDescription(
            new APIdaze.WebRTC.RTCSessionDescription({type:"answer", sdp:event.sdp}),
            function() {
              console.log(LOG_PREFIX + "Remote SDP set on videoPeerConnection");
              self.videoOfferNum = 1;
            },
            function(error) {
              console.log(LOG_PREFIX + "Failed to set SDP on videoPeerConnection : " + error);
            }
            );
        break;
      case "confbridgeleftssrc":
        console.log(LOG_PREFIX + "Need to remove SSRC for this conference : " + event.ssrc);
        this.videoOfferNum ++;
        this.remoteVideoSDP = this.remoteVideoSDP.replace(/o=APIdaze 1 [0-9]+ IN IP4 195.5.246.235/g, "o=APIdaze 1 " + this.videoOfferNum + " IN IP4 195.5.246.235");
        this.localVideoSDP = this.localVideoSDP.replace(/a=crypto.*\r\n/, "");
        var regex = new RegExp("a=ssrc:" + event.ssrc + " .*\r\n", "g");
        this.remoteVideoSDP = this.remoteVideoSDP.replace(regex, "");
        console.log(LOG_PREFIX + "Remote SDP : " + this.remoteVideoSDP);

        this.videoPeerConnection.setLocalDescription(new APIdaze.WebRTC.RTCSessionDescription({type:"offer", sdp:this.localVideoSDP}));
        this.videoPeerConnection.setRemoteDescription(
            new APIdaze.WebRTC.RTCSessionDescription({type:"answer", sdp:this.remoteVideoSDP}),
            function() { console.log(LOG_PREFIX + "Remote SDP set on videoPeerConnection"); },
            function(error) { console.log(LOG_PREFIX + "Failed to set SDP on videoPeerConnection : " + error); }
            );
        this.fire({type: "confbridgeleftssrc", data: JSON.stringify({room: event.room, channel: event.channel, ssrc: event.ssrc, msid: event.msid})});
        break;
      case "confbridgenewssrc":
        console.log(LOG_PREFIX + "Got new SSRC for this conference : " + event.ssrc);
        if (this.localVideoSDP.indexOf(event.ssrc) === -1) {
          console.log(LOG_PREFIX + "Looks like someone is publishing video in this room");  
          this.localVideoSDP = this.localVideoSDP.replace(/a=crypto.*\r\n/, "");
          console.log(LOG_PREFIX + "Local SDP : " + this.localVideoSDP);
          console.log(LOG_PREFIX + "this.videoOfferNum : " + this.videoOfferNum);
          if (this.videoOfferNum === 1) {
            // First update of the video peers
            this.remoteVideoSDP = this.remoteVideoSDP.replace(/1874557016/g, event.ssrc);
            this.remoteVideoSDP = this.remoteVideoSDP.replace(/o=APIdaze 1 1 IN IP4 195.5.246.235/g, "o=APIdaze 1 2 IN IP4 195.5.246.235");
            this.remoteVideoSDP = this.remoteVideoSDP.replace(/34IQ1WaD8ZmokM24/g, event.msid);
            this.videoOfferNum ++;
          } else {
            // Add new SDP attributes for this stream
            this.videoOfferNum ++;
            this.remoteVideoSDP = this.remoteVideoSDP.replace(/o=APIdaze 1 [0-9]+ IN IP4 195.5.246.235/g, "o=APIdaze 1 " + this.videoOfferNum + " IN IP4 195.5.246.235");
            var newssrc =   "a=ssrc:" + event.ssrc + " cname:" + event.msid + "\r\n" +
              "a=ssrc:" + event.ssrc + " msid:" + event.msid + " " + event.msid + "v0\r\n" +
              "a=ssrc:" + event.ssrc + " mslabel:" + event.msid + "\r\n" +
              "a=ssrc:" + event.ssrc + " label:" + event.msid + "v0\r\n";
            this.remoteVideoSDP = this.remoteVideoSDP.replace(/a=sendrecv\r\n/g, newssrc + "a=sendrecv\r\n");
          }

          console.log(LOG_PREFIX + "Remote SDP : " + this.remoteVideoSDP);
          this.videoPeerConnection.setLocalDescription(new APIdaze.WebRTC.RTCSessionDescription({type:"offer", sdp:this.localVideoSDP}));
          this.videoPeerConnection.setRemoteDescription(
              new APIdaze.WebRTC.RTCSessionDescription({type:"answer", sdp:this.remoteVideoSDP}),
              function() { console.log(LOG_PREFIX + "Remote SDP set on videoPeerConnection"); },
              function(error) { console.log(LOG_PREFIX + "Failed to set SDP on videoPeerConnection : " + error); }
              );
          this.fire({type: "confbridgenewssrc", data: JSON.stringify({room: event.room, channel: event.channel, ssrc: event.ssrc, msid: event.msid})});
        } else {
          console.log(LOG_PREFIX + "SSRC already caught, ignoring");
        }
        break;
      case "confbridgetextmessage":
        this.fire({type: "confbridgetextmessage", data: JSON.stringify({to: event.to, fromnick: event.from, fromchannel:event.astfrom, text:event.text})});
        break;
      case "confbridgevideostatusupdate":
        this.videoOfferNum ++;
        this.remoteVideoSDP = this.remoteVideoSDP.replace(/o=APIdaze 1 [0-9]+ IN IP4 195.5.246.235/g, "o=APIdaze 1 " + this.videoOfferNum + " IN IP4 195.5.246.235");

        if (event.status === "recvonly") {
          this.localVideoSDP = this.localVideoSDP.replace(/a=crypto.*\r\n/, "");
          regex = new RegExp("a=ssrc:" + event.ssrc + " .*\r\n", "g");
          this.remoteVideoSDP = this.remoteVideoSDP.replace(regex, "");
          console.log(LOG_PREFIX + "Remote SDP : " + this.remoteVideoSDP);

          this.videoPeerConnection.setLocalDescription(new APIdaze.WebRTC.RTCSessionDescription({type:"offer", sdp:this.localVideoSDP}));
          this.videoPeerConnection.setRemoteDescription(
              new APIdaze.WebRTC.RTCSessionDescription({type:"answer", sdp:this.remoteVideoSDP}),
              function() { console.log(LOG_PREFIX + "Remote SDP set on videoPeerConnection"); },
              function(error) { console.log(LOG_PREFIX + "Failed to set SDP on videoPeerConnection : " + error); }
              );
        } else if (event.status === "sendrecv") {
          var tempssrc =  "a=ssrc:" + event.ssrc + " cname:" + event.msid + "\r\n" +
                          "a=ssrc:" + event.ssrc + " msid:" + event.msid + " " + event.msid + "v0\r\n" +
                          "a=ssrc:" + event.ssrc + " mslabel:" + event.msid + "\r\n" +
                          "a=ssrc:" + event.ssrc + " label:" + event.msid + "v0\r\n";
          this.remoteVideoSDP = this.remoteVideoSDP.replace(/a=sendrecv\r\n/g, tempssrc + "a=sendrecv\r\n");
          console.log(LOG_PREFIX + "Remote SDP : " + this.remoteVideoSDP);
          this.videoPeerConnection.setLocalDescription(new APIdaze.WebRTC.RTCSessionDescription({type:"offer", sdp:this.localVideoSDP}));
          this.videoPeerConnection.setRemoteDescription(
              new APIdaze.WebRTC.RTCSessionDescription({type:"answer", sdp:this.remoteVideoSDP}),
              function() { console.log(LOG_PREFIX + "Remote SDP set on videoPeerConnection"); },
              function(error) { console.log(LOG_PREFIX + "Failed to set SDP on videoPeerConnection : " + error); }
              );
        }
        break;
      default:
        console.log(LOG_PREFIX + "Unknown event : " + JSON.stringify(event));
        console.log("Event type : " + event.type);
        break;
    }
  };

  /**
   * Stop sending local video
   */
  ConferenceRoom.prototype.stopLocalVideo = function() {
    this.videoPeerConnection.removeStream(this.localVideoStream);

    var tmp = {};
    tmp['command'] = "updatevideostream";
    tmp['apiKey'] = this.webRTCClient.configuration['apiKey'];
    tmp['roomname'] = this.roomName;
    tmp['identifier'] = this.roomIdentifier;
    tmp['channel'] = this.roomIdentifier;
    tmp['userKeys'] = {};
    tmp['userKeys']['apiKey'] = tmp['apiKey'];
    tmp['msid'] = this.myVideoBridgeChannelID;
    tmp['ssrc'] = this.myVideoBridgeSSRC;
    tmp['status'] = "recvonly";
    var message = JSON.stringify(tmp);

    this.webRTCClient.sendMessage(message);
  };

  /**
   * Start sending local video
   */
  ConferenceRoom.prototype.startLocalVideo = function() {
    this.videoPeerConnection.addStream(this.localVideoStream);
    console.log(LOG_PREFIX + "New SSRC to announce on the video bridge : " + this.myVideoBridgeSSRC);

    var tmp = {};
    tmp['command'] = "updatevideostream";
    tmp['apiKey'] = this.webRTCClient.configuration['apiKey'];
    tmp['roomname'] = this.roomName;
    tmp['identifier'] = this.roomIdentifier;
    tmp['channel'] = this.roomIdentifier;
    tmp['userKeys'] = {};
    tmp['userKeys']['apiKey'] = tmp['apiKey'];
    tmp['msid'] = this.myVideoBridgeChannelID;
    tmp['ssrc'] = this.myVideoBridgeSSRC;
    tmp['status'] = "sendrecv";
    var message = JSON.stringify(tmp);

    this.webRTCClient.sendMessage(message);
  };

  APIdaze.ConferenceRoom = ConferenceRoom;

}(APIdaze));
