(function(APIdaze) {
  var LOG_PREFIX = APIdaze.name +' | '+ 'Call' +' | ';

  var Call = function(client, listeners) {
    this.client = client;
 
    APIdaze.EventTarget.call(this);

    this.bind(listeners);

  };

  Call.prototype = new APIdaze.EventTarget();

  Call.prototype.sendDTMF = function(dtmf) {
    var tmp = {};
    tmp['command'] = "senddtmf";
    tmp['dtmf'] = dtmf;
    var message = JSON.stringify(tmp);
    
    this.client.sendMessage(message);
  };

  Call.prototype.inviteToConference = function(destination, number){
    console.log(LOG_PREFIX + "Inviting number " + number + " to conference " + destination);
    var request = {};
    request.wsp_version = "1";
    request.method = "modify";
    request.params = {
      callID: this.callID,
      action: "inviteToConference",
      destination: destination,
      number: number
    };

    this.client.sendMessage(JSON.stringify(request));
  };

  Call.prototype.unmuteAllInConference = function(destination){
    console.log(LOG_PREFIX + "Unmute everybody in conference " + destination);
    var request = {};
    request.wsp_version = "1";
    request.method = "modify";
    request.params = {
      callID: this.callID,
      action: "unmuteAllInConference",
      destination: destination
    };

    this.client.sendMessage(JSON.stringify(request));
  };

  Call.prototype.muteAllInConference = function(destination){
    console.log(LOG_PREFIX + "Mute everybody in conference " + destination);
    var request = {};
    request.wsp_version = "1";
    request.method = "modify";
    request.params = {
      callID: this.callID,
      action: "muteAllInConference",
      destination: destination
    };

    this.client.sendMessage(JSON.stringify(request));
  };

  Call.prototype.toggleMuteInConference = function(destination, conferenceMemberID){
    console.log(LOG_PREFIX + "Toggling mute status for member (" + conferenceMemberID + ") in conference " + destination);
    var request = {};
    request.wsp_version = "1";
    request.method = "modify";
    request.params = {
      callID: this.callID,
      action: "toggleMuteInConference",
      destination: destination,
      conferenceMemberID: conferenceMemberID
    };

    this.client.sendMessage(JSON.stringify(request));
  };

  Call.prototype.unmuteInConference = function(destination, conferenceMemberID){
    console.log(LOG_PREFIX + "Unmuting member (" + conferenceMemberID + ") in conference " + destination);
    var request = {};
    request.wsp_version = "1";
    request.method = "modify";
    request.params = {
      callID: this.callID,
      action: "unmuteInConference",
      destination: destination,
      conferenceMemberID: conferenceMemberID
    };

    this.client.sendMessage(JSON.stringify(request));
  };

  Call.prototype.muteInConference = function(destination, conferenceMemberID){
    console.log(LOG_PREFIX + "Muting member (" + conferenceMemberID + ") in conference " + destination);
    var request = {};
    request.wsp_version = "1";
    request.method = "modify";
    request.params = {
      callID: this.callID,
      action: "muteInConference",
      destination: destination,
      conferenceMemberID: conferenceMemberID
    };

    this.client.sendMessage(JSON.stringify(request));
  };

  Call.prototype.kickFromConference = function(destination, uuid){
    console.log(LOG_PREFIX + "Kicking member (" + uuid + ") out of conference " + destination);
    var request = {};
    request.wsp_version = "1";
    request.method = "modify";
    request.params = {
      callID: this.callID,
      action: "kickFromConference",
      destination: destination,
      uuid: uuid
    };

    this.client.sendMessage(JSON.stringify(request));
  };

  Call.prototype.modify = function(action, destination) {
    console.log(LOG_PREFIX + "Modifying call (" + action + ") with id : " + this.callID);
    var request = {};
    request.wsp_version = "1";
    request.method = "modify";
    switch(action) {
      case "hold":
        request.params = {
          callID: this.callID,
          action: action
        };
        break;
      case "unhold":
        request.params = {
          callID: this.callID,
          action: action
        };
        break;
      case "toggleHold":
        request.params = {
          callID: this.callID,
          action: action
        };
        break;
      case "conference":
        request.params = {
          callID: this.callID,
          action: action,
          destination: destination
        };
        break;
      default:
        console.log(LOG_PREFIX + "Unknown action " + action + ". Returning.");
        return;
    }

    this.client.sendMessage(JSON.stringify(request));
  };

  Call.prototype.hangup = function() {
    console.log(LOG_PREFIX + "Hanging up call with id : " + this.callID);
    switch(this.client.configuration.type) {
      case "webrtc":
        var request = {};
        request.wsp_version = "1";
        request.method = "hangup";
        request.params = {
          callID: this.callID
        };
        this.client.sendMessage(JSON.stringify(request));
        break;
      case "flash":
        try {
          this.client.$swfElem.hangup(this.client.callid);
        } catch(error) {
          console.log(LOG_PREFIX + "Error : " + error.message);
        }
        break;
      default:
        throw new APIdaze.Exceptions.ConfigurationError(this.client.configuration.type);
    }
  };

  Call.prototype.processEvent = function(event) {
    console.log(LOG_PREFIX + "Received event with info : " + event.method);
    console.log(LOG_PREFIX + "Received event with result : " + event.result);
 
    /**
     * event example : {"event": {"type": "channel", "info": "ringing"}}
     * We build a new event out of this one with a single type field
     */
    if (event.result && event.id === "conference_list_command") {
      var index;
      var lines = event.result.message.split('\n');
      var members = [];
      for (index = 0; index < lines.length - 1; index++) {
        var elems = lines[index].split(';');
        members.push({sessid: elems[2], nickname: elems[3], caller_id_number: elems[4], conferenceMemberID: elems[0], talking_flags: elems[5]});
      }
      this.fire({type: "roommembers", members: members});
    } else if (event.result && event.result.message) {
      console.log(LOG_PREFIX + "Received event with message : " + event.result.message);
      switch (event.result.message) {
        case "CALL CREATED":
          console.log(LOG_PREFIX + "Setting callID to this call to " + event.result.callID);
          this.callID = event.result.callID;
          break;
        case "CALL ENDED":
          console.log(LOG_PREFIX + "Call ended");
          this.fire({type: "hangup"});
          break;
        default:
          break;
      }
    } else if (event.result && typeof event.result.subscribedChannels === "object") {
      this.fire({type: "roominit"});
    } else if (event.params && event.params.data && event.params.data.action) {
      switch (event.params.data.action) {
        case "add":
          console.log(LOG_PREFIX + "Adding member");
          this.fire({type: "joinedroom", member: {sessid: event.params.data.hashKey, nickname: event.params.data.data[2], caller_id_number: event.params.data.data[1], conferenceMemberID: event.params.data.data[0]}});
          break;
        case "del":
          console.log(LOG_PREFIX + "Removing member");
          this.fire({type: "leftroom", member: {sessid: event.params.data.hashKey, nickname: event.params.data.data[2], caller_id_number: event.params.data.data[1], conferenceMemberID: event.params.data.data[0]}});
          break;
        case "modify":
          console.log(LOG_PREFIX + "Modify event");
          var status = JSON.parse(event.params.data.data[4]);
          this.fire({type: "talking", member: {sessid: event.params.data.hashKey, nickname: event.params.data.data[2], caller_id_number: event.params.data.data[1], talking: status.audio.talking, muted: status.audio.muted, energyScore: status.audio.energyScore, conferenceMemberID: event.params.data.data[0]}});
          break;
      }

    } else {
      this.fire({type: event.method});
    }
  };

  /**
   * Stop sending local audio. Avaibable for WebRTC calls only
   */
  Call.prototype.stopLocalAudio = function() {
    console.log(LOG_PREFIX + "Muting our audio");
    this.client.peerConnection.removeStream(this.client.localstream);
  };

  /**
   * Start sending local audio. Avaibable for WebRTC calls only
   */
  Call.prototype.startLocalAudio = function() {
    console.log(LOG_PREFIX + "Unmuting our audio");
    this.client.peerConnection.addStream(this.client.localstream);
  };

  APIdaze.Call = Call;

}(APIdaze));



