/* Exceptions */
(function(APIdaze){
  var Exceptions;

  Exceptions = {
    InitError: (function(){
      var exception = function(message) {
        this.code = 1;
        this.name = "INITIALISATION_ERROR";
        this.message = message;
      };

      exception.prototype = new Error();
      return exception;
    }()), 
    CallError: (function(){
      var exception = function(message) {
        this.code = 1;
        this.name = "CALL_ERROR";
        this.message = message;
      };

      exception.prototype = new Error();
      return exception;
    }()), 
    ConfigurationError: (function(){
      var exception = function(parameter) {
        this.code = 1;
        this.name = "CONFIGURATION_ERROR";
        this.message = "Wrong parameter : " + parameter + ". 'auto','webrtc','flash' are accepted." ;
      };

      exception.prototype = new Error();
      return exception;
    }()), 
    ConferenceRoomError: (function(){
      var exception = function(message) {
        this.code = 1;
        this.name = "CONFERENCE_ROOM_ERROR";
        this.message = message;
      };

      exception.prototype = new Error();
      return exception;
    }()) 
  };

  APIdaze.Exceptions = Exceptions;
}(APIdaze));
