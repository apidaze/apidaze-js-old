(function(APIdaze){

  /* This function is used internally */
  function isArraylike( obj ) {
    var length = obj.length,
    /**
     * Hack, the original line was :
     * type = jQuery.type( obj ); 
     * Since we don't depend on jQuery, well at least completely :)
     * we hasd to rewrite that. Did it according to an post detailing
     * how jQuery.type was implemented :
     * http://stackoverflow.com/questions/12206083/whats-the-difference-between-typeof-variable-function-and-jquery-isfunc
     */
    type = Object.prototype.toString.call( obj );

    if ( obj != null && obj === obj.window ) {
      return false;
    }

    if ( obj.nodeType === 1 && length ) {
      return true;
    }

    return type === "[object Array]" || type !== "[object Function]" &&
    ( length === 0 ||
      typeof length === "number" && length > 0 && ( length - 1 ) in obj );
  }


  var Utils = {
    /* Taken from jQuery 1.9-stable */
    each: function( obj, callback, args ) {
      var value,
      i = 0,
      length = obj.length,
      isArray = isArraylike( obj );

      if ( args ) {
        if ( isArray ) {
          for ( ; i < length; i++ ) {
            value = callback.apply( obj[ i ], args );

            if ( value === false ) {
              break;
            }
          }
        } else {
          for ( i in obj ) {
            value = callback.apply( obj[ i ], args );

            if ( value === false ) {
              break;
            }
          }
        }

        // A special, fast, case for the most common use of each
      } else {
        if ( isArray ) {
          for ( ; i < length; i++ ) {
            value = callback.call( obj[ i ], i, obj[ i ] );

            if ( value === false ) {
              break;
            }
          }
        } else {
          for ( i in obj ) {
            value = callback.call( obj[ i ], i, obj[ i ] );

            if ( value === false ) {
              break;
            }
          }
        }
      }

      return obj;
    },

    extend: function() {
      for(var i=1; i<arguments.length; i++) {
        for(var key in arguments[i]) {
          if(arguments[i].hasOwnProperty(key)) {
            arguments[0][key] = arguments[i][key];
          }
        }
      }
      return arguments[0];
    }
  };

  APIdaze.Utils = Utils;
}(APIdaze));

