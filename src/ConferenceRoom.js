(function(APIdaze) {
  var LOG_PREFIX = APIdaze.name +' | '+ 'ConferenceRoom' +' | ';

  var ConferenceRoom = function(webRTCClient, roomName, identifier, listeners) {
    this.client = webRTCClient;
    this.maxParticipants = APIdaze.maxroomparticipants;
    this.myChannelID = "";
    this.roomIdentifier = identifier;
    this.name = roomName;
    this.roomPeerConnections = [];       // Format : [{channelid: [Object String], peerconnection: [Object RTCPeerConnection]}]
 
    APIdaze.EventTarget.call(this);

    this.bind(listeners);

    /**
     * Private functions 
     */
    /*
    function createRoomPeerConnections(webRTCClient) {
      var pc_config = {"iceServers": [{"url": "stun:173.194.78.127:19302"}]};
      var pc_constraints = {"optional": [{"DtlsSrtpKeyAgreement": false}]};
      var constraints = { "optional": [],
                          "mandatory":  {
                                        "MozDontOfferDataChannel": true,
                                        'OfferToReceiveAudio':false, 
                                        'OfferToReceiveVideo':true
                                      }
                        };

      var peerConnection = new APIdaze.WebRTC.RTCPeerConnection(pc_config, pc_constraints);

      peerConnection.onicecandidate = function(event) {
        if (event.candidate) {
          console.log(LOG_PREFIX + "ICE candidate received: " + event.candidate.candidate);
        } else {
          console.log(LOG_PREFIX + "No more ICE candidate");
        }
      };

      peerConnection.onopen = function() {
        console.log(LOG_PREFIX + "PeerConnection open");
      };

      peerConnection.onstatechange = function() {
        console.log(LOG_PREFIX + "PeerConnection state changed");
      };

      peerConnection.onremovestream = function(stream) {
        console.log(LOG_PREFIX + "PeerConnection stream removed : " + stream);
      };

      peerConnection.onaddstream = function(mediaStreamEvent) {
        console.log(LOG_PREFIX + "PeerConnection stream added : " + mediaStreamEvent.stream.id);
        var domId = webRTCClient.createRemoteContainer(mediaStreamEvent.stream.id);
        document.querySelector("#"+domId).src = APIdaze.WebRTC.URL.createObjectURL(mediaStreamEvent.stream);
      };
      console.log(LOG_PREFIX + "Listeners added");

      // temporary measure to remove Moz* constraints in Chrome
      if (window.navigator.webkitGetUserMedia) {
        for (var prop in constraints.mandatory) {
          if (prop.indexOf("Moz") !== -1) {
            delete constraints.mandatory[prop];
          }
        }
      }   

      peerConnection.createOffer(function(sessionDescription) {
                                  // Function called on success
                                  var sdp = sessionDescription.sdp.replace("a=recvonly", "a=sendrecv");
                                  sessionDescription.sdp = sdp;
                                  peerConnection.setLocalDescription(sessionDescription); 
                                  console.log(LOG_PREFIX + "Local SDP for getvideostream : " + sessionDescription.sdp);
                                },
                                function(error) {
                                  // Function called on failure
                                  console.log(LOG_PREFIX + "Failed to create offer : " + error.message);
                                }, constraints);

      this.roomPeerConnections.push({channel: "", peerConnection: peerConnection});  

    }
    */

    /**
     * Create PeerConnections that will handle
     * the video streams of participants.
     */
    /*
    for (var i = 0; i < this.maxParticipants ; i++) {
      createRoomPeerConnections.call(this, webRTCClient);
    }
    */
  };

  ConferenceRoom.prototype = new APIdaze.EventTarget();

  ConferenceRoom.prototype.sendDTMF = function(dtmf) {
    var tmp = {};
    tmp['command'] = "senddtmf";
    tmp['dtmf'] = dtmf;
    var message = JSON.stringify(tmp);
    
    this.client.sendMessage(message);
  };

  ConferenceRoom.prototype.processEvent = function(event) {
    var roomPeerConnection = null;
    var i = 0;
    switch (event.type) {
      case "confbridgewelcome":
        console.log(LOG_PREFIX + "My channel identifier in room " + event.room + " : " + event.identifier);
        this.myChannelID = event.identifier;
        break;
      case "confbridgejoin":
       // if (event.channel !== this.myChannelID) {
          console.log(LOG_PREFIX + "Someone (" + event.channel + ") entered room " + event.room + ".");
          this.fire({type: "confbridgejoin", data: JSON.stringify({room: event.room, channel: event.channel, name: event.name, number: event.number})});
          /*
          roomPeerConnection = null;
          // Find a free roomPeerConnection
          for (i = 0; i < this.maxParticipants; i++) {
            if (this.roomPeerConnections[i].channel === "") {
              roomPeerConnection = this.roomPeerConnections[i].peerConnection;
              this.roomPeerConnections[i].channel = event.identifier;
              console.log(LOG_PREFIX + "roomPeerConnection[" + i + "].channel set to " + this.roomPeerConnections[i].channel + " and corresponding pc attached");
              break;
            }
          }
        
          if (roomPeerConnection === null) {
            throw new APIdaze.Exceptions.ConferenceRoomError("Number of peerConnections for video streams in this room exhausted");
          }

          var tmp = {};
          tmp['command'] = "getvideostream";
          tmp['channel'] = event.identifier;
          tmp['type'] = "offer";
          tmp['sdp'] = roomPeerConnection.localDescription.sdp;
          //var message = JSON.stringify(tmp);
          */
          //this.client.sendMessage(message);
       // }
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
        this.fire({type: "confbridgetalking", data: JSON.stringify({room: event.room, channel: event.channel, talkingstatus: event.talkingstatus})});
        break;
      case "confbridgegetvideostream":
        roomPeerConnection = null;
        // Find a free roomPeerConnection
        for (i = 0; i < this.maxParticipants; i++) {
          if (this.roomPeerConnections[i].channel === event.identifier) {
            roomPeerConnection = this.roomPeerConnections[i].peerConnection;
            this.roomPeerConnections[i].channel = event.identifier;
            console.log(LOG_PREFIX + "roomPeerConnection[" + i + "].channel matches with channel" + this.roomPeerConnections[i].channel + ". Now setting remote description with SDP : " + event.sdp);
            break;
          }
        }
        roomPeerConnection.setRemoteDescription(new APIdaze.WebRTC.RTCSessionDescription({type:"answer", sdp:event.sdp}));
        break;
      default:
        console.log(LOG_PREFIX + "Unknown event : " + JSON.stringify(event));
        console.log("Event type : " + event.type);
        break;
    }
  };


  APIdaze.ConferenceRoom = ConferenceRoom;

}(APIdaze));


