//Copyright (c) 2010 Nicholas C. Zakas. All rights reserved.
//MIT License
(function(APIdaze){
  var LOG_PREFIX = APIdaze.name +' | '+ 'EventTarget' +' | ';

  var Event = function(type, data) {
    this.type = type;
    this.data = data;
  };

  function EventTarget(){
    this._listeners = {};
  }

  EventTarget.prototype = {

    constructor: EventTarget,

    bind: function(config){
      for(var k in config) {
        if(k.match("^on")) {
          this.addListener(k.substr(2).toLowerCase(), config[k]);
        }
      }
    },

    addListener: function(type, listener){
      console.log(LOG_PREFIX + "New listener added to event type " + type);
      if (typeof this._listeners[type] === "undefined"){
        this._listeners[type] = [];
      }

      this._listeners[type].push(listener);
    },

    fire: function(event){
      if (typeof event === "string"){
        event = { type: event };
      }
      if (!event.target){
        event.target = this;
      }

      if (!event.type){  //falsy
        throw new Error("Event object missing 'type' property.");
      }

      if (this._listeners[event.type] instanceof Array){
        var listeners = this._listeners[event.type];
        for (var i=0, len=listeners.length; i < len; i++){
          listeners[i].call(this, event);
        }
      }
    },

    removeListener: function(type, listener){
      if (this._listeners[type] instanceof Array){
        var listeners = this._listeners[type];
        for (var i=0, len=listeners.length; i < len; i++){
          if (listeners[i] === listener){
            listeners.splice(i, 1);
            break;
          }
        }
      }
    }
  };

  APIdaze.Event = Event;
  APIdaze.EventTarget = EventTarget;

}(APIdaze));

