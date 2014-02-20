(function(APIdaze) {
  var LOG_PREFIX = APIdaze.name +' | '+ 'ConferenceRoom' +' | ';

  var ConferenceRoom = function(webRTCClient, roomName, identifier, listeners) {
    this.webRTCClient = webRTCClient;
    this.maxParticipants = APIdaze.maxroomparticipants;
    this.myChannelID = "";
    this.roomIdentifier = identifier;
    this.roomName = roomName;
    this.videoPeerConnection = {};      // A dedicated PeerConnection for video
    this.remoteVideoSDP = "";
    this.localVideoSDP = "";            // SDP obtained after creating the main Video RTCPeerConnection
    this.localVideoStream = {};
    this.videoOfferNum = 0;
    this.videoBridgeMsid = "";		// Video stream ID set by the videoBridge when empty. Must be replaced by user's stream id

    APIdaze.EventTarget.call(this);

    this.bind(listeners);

    /**
     * Private functions 
     */
  };

  ConferenceRoom.prototype = new APIdaze.EventTarget();

  /**
   * Call getUserMedia, and create the Video peerConnection 
   * */
  ConferenceRoom.prototype.joinInVideo = function() {
    var self = this;
    var opts = {audio: false, video: true}; 
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


  ConferenceRoom.prototype.createVideoPeerConnection = function() {
    var self = this;
    var pc_config = {"iceServers": [{"url": "stun:195.5.246.235:3478"}, {"url": "stun:stun.l.google.com:19302"}]};

    console.log(LOG_PREFIX + "Creating VideoPeerConnection...");
    try {
      this.videoPeerConnection = new APIdaze.WebRTC.RTCPeerConnection(pc_config, {'mandatory': {'OfferToReceiveAudio':false, 'OfferToReceiveVideo':true}});

      /**
       * Create various callback functions, the most important
       * being onicecandidate as we send our SDP offer once
       * all candidates are gathered.
       */
      this.videoPeerConnection.onicecandidate = function(event) {
        if (event.candidate) {
          console.log(LOG_PREFIX + "ICE candidate received: " + event.candidate.candidate);
        } else {
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
          tmp['sdp'] = self.videoPeerConnection.localDescription.sdp.replace(/\r\n/g, "|") + "a=apidazeroomname:" + self.roomName;
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
          /** Ignore this stream id, given back first by the video bridge */
          return;
        }

        var element = document.querySelector("#_apidaze-av-webrtc-remote-" + mediaStreamEvent.stream.id);
        document.body.removeChild(element);
      };

      this.videoPeerConnection.onaddstream = function(mediaStreamEvent) {
        console.log(LOG_PREFIX + "Video PeerConnection stream added : " + mediaStreamEvent.stream.id);
        if (mediaStreamEvent.stream.id === "34IQ1WaD8ZmokM24") {
          /** Ignore this stream id, given back first by the video bridge */
          return;
        }

        var domId = self.webRTCClient.createVideoRemoteContainer(mediaStreamEvent.stream.id);
        document.querySelector("#"+domId).src = APIdaze.WebRTC.URL.createObjectURL(mediaStreamEvent.stream);
      };

      console.log(LOG_PREFIX + "Listeners added");

      if (self.webRTCClient.status | APIdaze.WebRTCAV.CONSTANTS.STATUS_LOCALSTREAM_ATTACHED) {
        this.videoPeerConnection.addStream(this.localVideoStream);
      } else {
        console.log(LOG_PREFIX + "Localstream not ready, cannot create Video PeerConnection");
        throw new APIdaze.Exceptions.InitError("WebRTC localstream not ready");
      }

      this.videoPeerConnection.createOffer(
          function(sessionDescription) {
            // Function called on success
            self.videoPeerConnection.setLocalDescription(sessionDescription); 
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

  ConferenceRoom.prototype.sendDTMF = function(dtmf) {
    var tmp = {};
    tmp['command'] = "senddtmf";
    tmp['dtmf'] = dtmf;
    var message = JSON.stringify(tmp);

    this.webRTCClient.sendMessage(message);
  };

  ConferenceRoom.prototype.processEvent = function(event) {
    var self = this;
    switch (event.type) {
      case "confbridgewelcome":
        console.log(LOG_PREFIX + "My channel identifier in room " + event.room + " : " + event.identifier);
        this.myChannelID = event.identifier;
        break;
      case "confbridgejoin":
        // if (event.channel !== this.myChannelID) {
        console.log(LOG_PREFIX + "Someone (" + event.channel + ") entered room " + event.room + ".");
        this.fire({type: "confbridgejoin", data: JSON.stringify({room: event.room, channel: event.channel, name: event.name, number: event.number})});
        break;
      case "confbridgeleave":
        console.log(LOG_PREFIX + "Someone (" + event.channel +") left room " + event.room + ".");
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
        break;
      case "confbridgenewssrc":
        console.log(LOG_PREFIX + "Got new SSRC for this conference : " + event.ssrc);
        if (this.localVideoSDP.indexOf(event.ssrc) === -1) {
          console.log(LOG_PREFIX + "Looks like someone is publishing video in this room");  
          this.localVideoSDP = this.localVideoSDP.replace(/a=crypto.*\r\n/, "");
          console.log(LOG_PREFIX + "Local SDP : " + this.localVideoSDP);
          console.log(LOG_PREFIX + "this.videoOfferNum : " + this.videoOfferNum);
          if (this.videoOfferNum === 1) {
            /** First update of the video peers */
            this.remoteVideoSDP = this.remoteVideoSDP.replace(/1874557016/g, event.ssrc);
            this.remoteVideoSDP = this.remoteVideoSDP.replace(/o=APIdaze 1 1 IN IP4 195.5.246.235/g, "o=APIdaze 1 2 IN IP4 195.5.246.235");
            this.remoteVideoSDP = this.remoteVideoSDP.replace(/34IQ1WaD8ZmokM24/g, event.msid);
            this.videoOfferNum ++;
          } else {
            /** Add new SDP attributes for this stream */
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
        } else {
          console.log(LOG_PREFIX + "SSRC already caught, ignoring");
        }
        break;
      default:
        console.log(LOG_PREFIX + "Unknown event : " + JSON.stringify(event));
        console.log("Event type : " + event.type);
        break;
    }
    };


    APIdaze.ConferenceRoom = ConferenceRoom;

  }(APIdaze));


