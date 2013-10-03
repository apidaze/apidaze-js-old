/* APIdaze client definition */
(function(APIdaze){
  var LOG_PREFIX = APIdaze.name +' | '+ 'CLIENT' +' | ';
  var CLIENT,
    CONSTANTS = {
      STATUS_INIT :           0,
      STATUS_READY :          1,
      STATUS_NOTREADY :       2
    };

  CLIENT = function(config) {
    APIdaze.EventTarget.call(this);
    this.configuration = {
      // Default options
      debug: false,
      type: "auto",
      apiKey: "none"
    };
    this.status = CONSTANTS.STATUS_INIT;

    try {
      this.init(config);
      console.log(LOG_PREFIX + "Client initialized");
    } catch (e) {
      this.status = CONSTANTS.STATUS_NOTREADY;
      throw e;
    }

    if (this.status === CONSTANTS.STATUS_NOTREADY) {
      throw new APIdaze.Exceptions.CallError("Client is not ready");
    }

    this.bind(this.configuration);

    switch (this.configuration.type) {
      case "webrtc":
        this.webRTCAV = new APIdaze.WebRTCAV(this);
        break;
      case "flash":
      case "auto":
        this.flashAudio = new APIdaze.FlashAudio(this);
        break;
      default:
        this.flashAudio = new APIdaze.FlashAudio(this);
        break;
    }

    return this;
  };

  CLIENT.prototype = new APIdaze.EventTarget();

  CLIENT.prototype.init = function(config){
    APIdaze.Utils.extend(this.configuration, config);
    switch(this.configuration.type) {
      case "webrtc":
        break;
      case "flash":
        break;
      case "auto":
        this.configuration.type = "flash";
        break;
      default:
        throw new APIdaze.Exceptions.ConfigurationError(this.configuration.type);
    }
  };

  CLIENT.prototype.call = function(params, listeners) {
    if (this.status !== CONSTANTS.STATUS_READY) {
      throw new APIdaze.Exceptions.CallError("Client is not ready");
    }

    switch(this.configuration.type) {
      case "webrtc":
        return this.webRTCAV.call(params, listeners);
      case "flash":
      case "auto":
        return this.flashAudio.call(params, listeners);
      default:
        return this.flashAudio.call(params, listeners);
    }
  };

  CLIENT.prototype.joinroom = function(dest, identifier, listeners) {
    if (this.status !== CONSTANTS.STATUS_READY) {
      throw new APIdaze.Exceptions.CallError("Client is not ready");
    }

    switch(this.configuration.type) {
      case "webrtc":
        this.bind(listeners);
        this.webRTCAV.joinroom(dest, identifier, listeners);
        return this.webRTCAV;
      case "flash":
      case "auto":
        throw new APIdaze.Exceptions.CallError("Method joinroom not implemented in non WebRTC channels");
      default:
        throw new APIdaze.Exceptions.CallError("Method joinroom not implemented in non WebRTC channels");
    }
  };

  CLIENT.prototype.connect = function() {
    switch(this.configuration.type) {
      case "webrtc":
        this.webRTCAV.connect();
        break;
      case "flash":
      case "auto":
        this.flashAudio.connect();
        break;
      default:
        this.flashAudio.connect();
        break;
    }
  };

  CLIENT.prototype.disconnect = function() {
    switch(this.configuration.type) {
      case "webrtc":
        this.webRTCAV.disconnect();
        break;
      case "flash":
      case "auto":
        this.flashAudio.disconnect();
        break;
      default:
        this.flashAudio.disconnect();
        break;
    }
  };

  CLIENT.prototype.WebRTCAudio = function() {
    console.log(LOG_PREFIX + "Starting WebRTCAudio");
  };

  CLIENT.CONSTANTS = CONSTANTS;
  APIdaze.CLIENT = CLIENT;
}(APIdaze));
