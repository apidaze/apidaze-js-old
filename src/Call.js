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

  Call.prototype.processEvent = function(event) {
    console.log(LOG_PREFIX + "Received event");
  
    /**
     * event example : {"event": {"type": "channel", "info": "ringing"}}
     * We build a new event out of this one with a single type field
     */
    var newevent = {'type': event.info};

    this.fire(newevent);
  };

  APIdaze.Call = Call;

}(APIdaze));



