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
        var tmp = {};
        tmp['command'] = "hangup";
        tmp['apiKey'] = this.client.configuration['apiKey'];
        tmp['userKeys'] = {"command":"hangup"};
        this.client.sendMessage(JSON.stringify(tmp));
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
    console.log(LOG_PREFIX + "Received event with info : " + event.info);
  
    /**
     * event example : {"event": {"type": "channel", "info": "ringing"}}
     * We build a new event out of this one with a single type field
     */
    var newevent = {type: event.info};

    this.fire(newevent);
  };

  APIdaze.Call = Call;

}(APIdaze));



