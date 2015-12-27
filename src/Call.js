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

  Call.prototype.hangup = function() {
    console.log(LOG_PREFIX + "Hanging up call");
    switch(this.client.configuration.type) {
      case "webrtc":
        var request = {};
        request.wsp_version = "1";
        request.method = "hangup";
        request.params = {};
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
    if (event.result && typeof event.result.subscribedChannels === "object") {
      this.fire({type: "roominit"});
    } else if (event.result && event.id === "conference_list_command") {
      var index;
      var lines = event.result.message.split('\n');
      var members = [];
      for (index = 0; index < lines.length - 1; index++) {
        var elems = lines[index].split(';');
        members.push({sessid: elems[2], nickname: elems[3], caller_id_number: elems[4]});
      }
      this.fire({type: "roommembers", members: members});
    } else if (event.params && event.params.data && event.params.data.action) {
      switch (event.params.data.action) {
        case "add":
          console.log(LOG_PREFIX + "Adding member");
          this.fire({type: "joinedroom", member: {sessid: event.params.data.hashKey, nickname: event.params.data.data[2], caller_id_number: event.params.data.data[1]}});
          break;
        case "del":
          console.log(LOG_PREFIX + "Removing member");
          this.fire({type: "leftroom", member: {sessid: event.params.data.hashKey, nickname: event.params.data.data[2], caller_id_number: event.params.data.data[1]}});
          break;
        case "modify":
          console.log(LOG_PREFIX + "Modify event");
          var status = JSON.parse(event.params.data.data[4]);
          this.fire({type: "talking", member: {sessid: event.params.data.hashKey, nickname: event.params.data.data[2], caller_id_number: event.params.data.data[1], talking: status.audio.talking}});
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



