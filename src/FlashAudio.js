/*global swfobject: false*/ 
(function(APIdaze) {
  var LOG_PREFIX = APIdaze.name +' | '+ 'FlashAudio' ;
  var FlashAudioCount = 0;
  var plugin;

  // Those functions handle events received from Flash
  // and called from within SWF using ExternalInterface.call.
  // domid is derived from the DOM ID of the div container :
  // container ID : #_apidaze-audio-flash-div0
  // domid : #_apidaze-audio-flash-div0-swf
  var EI = {
    onMakeCall: function(domid, uuid, number, account) {
      var domidstr = domid.toString();
      console.log(LOG_PREFIX + "APIdaze.CLIENT.FlashAudio.EI.onMakeCall called domid : " + domid);
      try {
        console.log(LOG_PREFIX + "Flash ID : " + domidstr.slice(0,domidstr.length-4));
        console.log(LOG_PREFIX + "uuid : " + uuid + " - number : " + number + " - account : " + account);
        document.querySelector("#"+domidstr.slice(0,domidstr.length-4)).handleFlashEvent({eventType: "makecall", data:uuid});
      } catch(error) {
        console.log(LOG_PREFIX + "Error : " + error.message);
      }
    },
    onHangup: function(domid, sid, cause) {
      var domidstr = domid.toString();
      console.log(LOG_PREFIX + "APIdaze.CLIENT.FlashAudio.EI.onHangup called domid : " + domid);
      try {
        console.log(LOG_PREFIX + "Flash ID : " + domidstr.slice(0,domidstr.length-4));
        document.querySelector("#"+domidstr.slice(0,domidstr.length-4)).handleFlashEvent({eventType: "hangup", data:cause});
      } catch(error) {
        console.log(LOG_PREFIX + "Error : " + error.message);
      }
    },
    onCallState: function(domid, sid, state) {
      var domidstr = domid.toString();
      console.log(LOG_PREFIX + "APIdaze.CLIENT.FlashAudio.EI.onCallState called domid : " + domid + " data : " + state);
      try {
        console.log(LOG_PREFIX + "Flash ID : " + domidstr.slice(0,domidstr.length-4));
        document.querySelector("#"+domidstr.slice(0,domidstr.length-4)).handleFlashEvent({eventType: "callstate", data:state});
      } catch(error) {
        console.log(LOG_PREFIX + "Error : " + error.message);
      }
    },
    onEvent: function(domid, message) {
      var domidstr = domid.toString();
      try {
        document.querySelector("#"+domidstr.slice(0,domidstr.length-4)).handleFlashEvent({eventType: "event", data:message});
      } catch(error) {
        console.log(LOG_PREFIX + "Error : " + error.message);
      }
    },
    onDebug: function(domid, message) {
      var domidstr = domid.toString();
      try {
        document.querySelector("#"+domidstr.slice(0,domidstr.length-4)).handleFlashEvent({eventType: "debug", data:message});
      } catch(error) {
        console.log(LOG_PREFIX + "Error : " + error.message);
      }
    },
    onDisconnected: function(domid) {
      var domidstr = domid.toString();
      console.log(LOG_PREFIX + "APIdaze.CLIENT.FlashAudio.EI.onDisconnected called domid : " + domid);
      try {
        console.log(LOG_PREFIX + "Flash ID : " + domidstr.slice(0,domidstr.length-4));
        document.querySelector("#"+domidstr.slice(0,domidstr.length-4)).handleFlashEvent({eventType: "disconnected", data: "none"});
      } catch(error) {
        console.log(LOG_PREFIX + "Error : " + error.message);
      }
    },
    onConnected: function(domid, sid) {
      var domidstr = domid.toString();
      console.log(LOG_PREFIX + "APIdaze.CLIENT.FlashAudio.EI.onConnected called domid : " + domid);
      try {
        console.log(LOG_PREFIX + "Flash ID : " + domidstr.slice(0,domidstr.length-4));
        document.querySelector("#"+domidstr.slice(0,domidstr.length-4)).handleFlashEvent({eventType: "connected", data:sid});
      } catch(error) {
        console.log(LOG_PREFIX + "Error : " + error.message);
      }
    }
  };

  var FlashAudio = function(client) {
    this.client = client;
    this.callid = "";
    var swfurl = APIdaze.swfurl;
    var rtmp_url = APIdaze.rtmpurl;
    this.configuration = {};
    this.callobj = null;                // Call object instantiated by this.call

    APIdaze.EventTarget.call(this);

    this.configuration = APIdaze.Utils.extend({containerId: "", flashmode: "rtmp"}, client.configuration);
    if (this.configuration.flashmode === "rtmfp") {
      swfurl = APIdaze.swfurl_rtmfp;
      rtmp_url = APIdaze.rtmfpurl;
      LOG_PREFIX += ' (RTMFP/UDP) | ';
    } else {
      LOG_PREFIX += ' (RTMP/TCP) | ';
    } 

    console.log(LOG_PREFIX + "Starting FlashAudio in mode " + this.configuration.flashmode);

    if (this.configuration.containerId === "") {
      this.configuration.containerId = this.createContainer();
    }

    plugin = this;

    this.bind({
      "onSwfLoaded": function(event){
        console.log(LOG_PREFIX + "Flash loaded event.type : " + event.type + " event.data : " + event.data);
      },
      "onConnected": function(event){
        console.log(LOG_PREFIX + "connected type : " + event.type);
        console.log(LOG_PREFIX + "connected data : " + event.data);
        this.client.status = APIdaze.CLIENT.CONSTANTS.STATUS_READY;
        this.client.fire({type: "ready", data: event.data});
      },
      "onDisconnected": function(){
        console.log(LOG_PREFIX + "disconnected");
        this.client.status = APIdaze.CLIENT.CONSTANTS.STATUS_NOTREADY;
        this.client.fire({type: "disconnected", data: "none"});
      }
    });
    if (client.configuration.debug === true) {
      this.bind({
        "onDebug": function(event){
          console.log(LOG_PREFIX + "Flash debug message: " + event.data);
        },
        "onEvent": function(event){
          console.log(LOG_PREFIX + "Flash event message: " + event.data);
        }  
      });
    }

    this.$flash = document.querySelector("#"+this.configuration.containerId);

    swfobject.embedSWF(swfurl,
                      this.configuration.containerId + "-swf",
                      "100%",
                      "100%",
                      "9.0.0",
                      "expressInstall.swf",
                      {rtmp_url: rtmp_url},
                      {allowscriptaccess: "always"},
                      {id: this.configuration.containerId + "-swf", name: this.configuration.containerId + "-swf"},
                      this.onloaded);

  };

  FlashAudio.prototype = new APIdaze.EventTarget();

  FlashAudio.prototype.onloaded = function(e) {
    console.log(LOG_PREFIX + "Flash object load operation result. e.success : " + e.success + " e.id : " + e.id + " e.ref : " + e.ref);
    if (e.success) {
      plugin.$flash.handleFlashEvent({eventType: "swfLoaded"});
      plugin.$swfElem = document.querySelector("#"+e.id);
    } else {
      plugin.$flash.handleFlashEvent({eventType: "swfNotLoaded"});
    }
  };

  FlashAudio.prototype.createContainer = function() {
    var flashDiv = document.createElement('div');
    var swfDiv = document.createElement('div');

    flashDiv.id = "_apidaze-audio-flash-div" + FlashAudioCount++;
    swfDiv.id = flashDiv.id + "-swf";

    flashDiv.appendChild(swfDiv);
    document.body.appendChild(flashDiv);

    var flashDomElem = document.querySelector("#"+flashDiv.id);

    flashDomElem.flashAudio = this;

    // Function called by APIdaze.FlashAudio.EI.XXXX
    flashDomElem.handleFlashEvent = function(event) {
      switch(event.eventType) {
        case "makecall":
          this.flashAudio.callid = event.data;
          break;
        case "connected":
          this.flashAudio.fire({type:"connected", data:event.data});
          break;
        case "disconnected":
          this.flashAudio.fire({type:"disconnected", data:"none"});
          break;
        case "swfLoaded":
          this.flashAudio.fire({type:"swfLoaded", data:event.data});
          break;
        case "swfNotLoaded":
          this.flashAudio.fire({type:"swfNotLoaded", data:event.data});
          break;
        case "event":
          this.flashAudio.fire({type:"event", data:event.data});
          break;
        case "debug":
          this.flashAudio.fire({type:"debug", data:event.data});
          break;
        case "callstate":
          switch (event.data) {
            case "ringing":
              flashDomElem.flashAudio.callobj.processEvent({type:"channel", info:"ringing"});
              break;
            case "answered":
              flashDomElem.flashAudio.callobj.processEvent({type:"channel", info:"answered"});
              break;
            case "hangup":
              flashDomElem.flashAudio.callobj.processEvent({type:"channel", info:"hangup"});
              break;
            default:
              break;
          }
          break;
        default:
          break;
      }
    };

    flashDomElem.style.width = "250px";
    flashDomElem.style.height = "150px";
    flashDomElem.style.position = "absolute";
    flashDomElem.style.top = "50%";
    flashDomElem.style.left = "50%";
    flashDomElem.style.marginTop = "-69px";
    flashDomElem.style.marginLeft = "-107px";
    flashDomElem.style.zIindex = "10001";
    flashDomElem.style.visibility = "visible";
/*
    flashDomElem.style = {
      witdh: "150px",
      height: "250px",
      position: "absolute",
      top: "50%",
      left: "50%",
      marginTop: "-69px",
      marginLeft: "-107px",
      zIndex: "10001",
      visibility: "visible"
    };
*/
    swfDiv.style = {
      "witdh":  "250px",
      "height":  "150px",
      "position": "absolute",
      "top": "50%",
      "left": "50%",
      "margin-top": "-69px",
      "margin-left": "-107px",
      "z-index": "10001",
      "visibility": "visible"
    };

    return flashDiv.id;
  };

  FlashAudio.prototype.call = function(params, listeners) {
    var apiKey = this.configuration['apiKey'];

    console.log(LOG_PREFIX + JSON.stringify(params));
//    console.log(LOG_PREFIX + params.toString());

    try {
      if (apiKey === null || apiKey === '' || typeof apiKey === "undefined") {
        throw new APIdaze.Exceptions.InitError("API key is empty");
      }

      params['apiKey'] = apiKey;
      
      if (this.$swfElem.isMuted()) {
        console.log(LOG_PREFIX + "Microphone muted");
        this.$swfElem.showPrivacy();
      }
      this.$swfElem.makeCall(JSON.stringify(params), null, null);

      return this.callobj = new APIdaze.Call(this, listeners);
    } catch(error) {
      console.log(LOG_PREFIX + "Error : " + error.message);
    }
  };

  FlashAudio.prototype.connect = function() {
    try {
      this.$swfElem.connect(); 
    } catch(error) {
      console.log(LOG_PREFIX + "Error : " + error.message);
    }
  };

  FlashAudio.prototype.showPersmissionBox = function() {

  };

  FlashAudio.prototype.hasPermission = function() {

  };

  FlashAudio.EI = EI;
  APIdaze.FlashAudio = FlashAudio;

}(APIdaze));
